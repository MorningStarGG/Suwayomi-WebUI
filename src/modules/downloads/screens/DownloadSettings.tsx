/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useTranslation } from 'react-i18next';
import { useLayoutEffect } from 'react';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Switch from '@mui/material/Switch';
import ListSubheader from '@mui/material/ListSubheader';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';

import { TextSetting } from '@/modules/core/components/settings/text/TextSetting.tsx';
import { requestManager } from '@/lib/requests/RequestManager.ts';
import { DownloadAheadSetting } from '@/modules/downloads/components/DownloadAheadSetting.tsx';
import {
    createUpdateMetadataServerSettings,
    useMetadataServerSettings,
} from '@/modules/settings/services/ServerSettingsMetadata.ts';
import { makeToast } from '@/modules/core/utils/Toast.ts';
import { DeleteChaptersWhileReadingSetting } from '@/modules/downloads/components/DeleteChaptersWhileReadingSetting.tsx';
import { CategoriesInclusionSetting } from '@/modules/category/components/CategoriesInclusionSetting.tsx';
import { NumberSetting } from '@/modules/core/components/settings/NumberSetting.tsx';
import { LoadingPlaceholder } from '@/modules/core/components/placeholder/LoadingPlaceholder.tsx';
import { EmptyViewAbsoluteCentered } from '@/modules/core/components/placeholder/EmptyViewAbsoluteCentered.tsx';
import { defaultPromiseErrorHandler } from '@/lib/DefaultPromiseErrorHandler.ts';
import { GetCategoriesSettingsQuery, GetCategoriesSettingsQueryVariables } from '@/lib/graphql/generated/graphql.ts';
import { GET_CATEGORIES_SETTINGS } from '@/lib/graphql/queries/CategoryQuery.ts';
import { MetadataDownloadSettings } from '@/modules/downloads/Downloads.types.ts';
import { ServerSettings } from '@/modules/settings/Settings.types.ts';
import { getErrorMessage } from '@/lib/HelperFunctions.ts';
import { useNavBarContext } from '@/modules/navigation-bar/contexts/NavbarContext.tsx';
import { SelectSetting } from '@/modules/core/components/settings/SelectSetting.tsx';

// Format variables info
const FORMAT_VARIABLES_INFO = {
    mangaFolderFormat: [
        { variable: '{manga_title}', description: 'Manga title' },
        { variable: '{source}', description: 'Source name' },
    ],
    chapterFolderFormat: [
        { variable: '{manga_title}', description: 'Manga title' },
        { variable: '{number}', description: 'Chapter number' },
        { variable: '{number_padded}', description: 'Chapter number with 2-digit padding' },
        { variable: '{number_padded3}', description: 'Chapter number with 3-digit padding' },
        { variable: '{volume}', description: 'Volume number' },
        { variable: '{volume_prefix}', description: 'Volume prefix (e.g., "Vol.1 ")' },
        { variable: '{chapter_name}', description: 'Chapter name' },
        { variable: '{title_suffix}', description: 'Title suffix (e.g., ": The Battle")' },
        { variable: '{scanlator}', description: 'Scanlator name' },
    ],
    cbzFileFormat: [
        { variable: '{manga_title}', description: 'Manga title' },
        { variable: '{number}', description: 'Chapter number' },
        { variable: '{number_padded}', description: 'Chapter number with 2-digit padding' },
        { variable: '{number_padded3}', description: 'Chapter number with 3-digit padding' },
        { variable: '{volume}', description: 'Volume number' },
        { variable: '{volume_prefix}', description: 'Volume prefix (e.g., "Vol.1 ")' },
        { variable: '{chapter_name}', description: 'Chapter name' },
        { variable: '{title_suffix}', description: 'Title suffix (e.g., ": The Battle")' },
        { variable: '{scanlator}', description: 'Scanlator name' },
    ],
};

type DownloadSettingsType = Pick<
    ServerSettings,
    | 'downloadAsCbz'
    | 'downloadsPath'
    | 'autoDownloadNewChapters'
    | 'autoDownloadNewChaptersLimit'
    | 'excludeEntryWithUnreadChapters'
    | 'autoDownloadIgnoreReUploads'
    | 'mangaFolderFormat'
    | 'chapterFolderFormat'
    | 'cbzFileFormat'
    | 'useAnilist'
    | 'anilistDefaultUncertainAction'
>;

const extractDownloadSettings = (settings: ServerSettings): DownloadSettingsType => ({
    downloadAsCbz: settings.downloadAsCbz,
    downloadsPath: settings.downloadsPath,
    autoDownloadNewChapters: settings.autoDownloadNewChapters,
    autoDownloadNewChaptersLimit: settings.autoDownloadNewChaptersLimit,
    excludeEntryWithUnreadChapters: settings.excludeEntryWithUnreadChapters,
    autoDownloadIgnoreReUploads: settings.autoDownloadIgnoreReUploads,
    mangaFolderFormat: settings.mangaFolderFormat,
    chapterFolderFormat: settings.chapterFolderFormat,
    cbzFileFormat: settings.cbzFileFormat,
    useAnilist: settings.useAnilist,
    anilistDefaultUncertainAction: settings.anilistDefaultUncertainAction,
});

// Component to display format variables
const FormatVariablesList = ({ formatType }: { formatType: keyof typeof FORMAT_VARIABLES_INFO }) => {
    const variables = FORMAT_VARIABLES_INFO[formatType];

    return (
        <Box sx={{ mt: 1, ml: 2 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
                Available variables:
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {variables.map((v) => (
                    <Tooltip key={v.variable} title={v.description} arrow>
                        <Chip
                            label={v.variable}
                            size="small"
                            variant="outlined"
                            sx={{
                                fontSize: '0.75rem',
                                '&:hover': { backgroundColor: 'action.hover' },
                            }}
                        />
                    </Tooltip>
                ))}
            </Box>
        </Box>
    );
};

export const DownloadSettings = () => {
    const { t } = useTranslation();
    const { setTitle, setAction } = useNavBarContext();

    useLayoutEffect(() => {
        setTitle(t('download.title.download'));
        setAction(null);

        return () => {
            setTitle('');
            setAction(null);
        };
    }, [t]);

    const categories = requestManager.useGetCategories<GetCategoriesSettingsQuery, GetCategoriesSettingsQueryVariables>(
        GET_CATEGORIES_SETTINGS,
    );
    const serverSettings = requestManager.useGetServerSettings({ notifyOnNetworkStatusChange: true });
    const [mutateSettings] = requestManager.useUpdateServerSettings();
    const {
        settings: metadataSettings,
        loading: areMetadataServerSettingsLoading,
        request: { error: metadataServerSettingsError, refetch: refetchMetadataServerSettings },
    } = useMetadataServerSettings();

    const loading = serverSettings.loading || areMetadataServerSettingsLoading || categories.loading;
    if (loading) {
        return <LoadingPlaceholder />;
    }

    const error = serverSettings.error ?? metadataServerSettingsError ?? categories.error;
    if (error) {
        return (
            <EmptyViewAbsoluteCentered
                message={t('global.error.label.failed_to_load_data')}
                messageExtra={getErrorMessage(error)}
                retry={() => {
                    if (serverSettings.error) {
                        serverSettings
                            .refetch()
                            .catch(defaultPromiseErrorHandler('DownloadSettings::refetchServerSettings'));
                    }

                    if (metadataServerSettingsError) {
                        refetchMetadataServerSettings().catch(
                            defaultPromiseErrorHandler('refetchMetadataServerSettings::'),
                        );
                    }

                    if (categories.error) {
                        categories.refetch().catch(defaultPromiseErrorHandler('LibrarySettings::refetchCategories'));
                    }
                }}
            />
        );
    }

    const downloadSettings = extractDownloadSettings(serverSettings.data!.settings);

    const updateSetting = <Setting extends keyof DownloadSettingsType>(
        setting: Setting,
        value: DownloadSettingsType[Setting],
    ) => {
        mutateSettings({ variables: { input: { settings: { [setting]: value } } } }).catch((e) =>
            makeToast(t('global.error.label.failed_to_save_changes'), 'error', getErrorMessage(e)),
        );
    };

    const updateMetadataSetting = createUpdateMetadataServerSettings<keyof MetadataDownloadSettings>((e) =>
        makeToast(t('global.error.label.failed_to_save_changes'), 'error', getErrorMessage(e)),
    );

    return (
        <List sx={{ pt: 0 }}>
            <TextSetting
                settingName={t('download.settings.download_path.label.title')}
                dialogDescription={t('download.settings.download_path.label.description')}
                value={downloadSettings?.downloadsPath}
                settingDescription={
                    downloadSettings?.downloadsPath.length ? downloadSettings.downloadsPath : t('global.label.default')
                }
                handleChange={(path) => updateSetting('downloadsPath', path)}
            />
            <ListItem>
                <ListItemText primary={t('download.settings.file_type.label.cbz')} />
                <Switch
                    edge="end"
                    checked={!!downloadSettings?.downloadAsCbz}
                    onChange={(e) => updateSetting('downloadAsCbz', e.target.checked)}
                />
            </ListItem>

            {/* Format Settings Section */}
            <List
                subheader={
                    <ListSubheader component="div" id="download-settings-format">
                        {t('format.settings.title')}
                    </ListSubheader>
                }
            >
                <ListItem>
                    <ListItemText
                        primary={t('format.settings.explanation')}
                        secondary={t('format.settings.explanation_detail')}
                    />
                </ListItem>

                <TextSetting
                    settingName={t('format.settings.manga_folder_format.label.title')}
                    dialogDescription={t('format.settings.manga_folder_format.label.description')}
                    value={downloadSettings?.mangaFolderFormat || '{source}/{manga_title}'}
                    settingDescription={downloadSettings?.mangaFolderFormat || '{source}/{manga_title}'}
                    handleChange={(format) => updateSetting('mangaFolderFormat', format)}
                />
                <FormatVariablesList formatType="mangaFolderFormat" />

                <TextSetting
                    settingName={t('format.settings.chapter_folder_format.label.title')}
                    dialogDescription={t('format.settings.chapter_folder_format.label.description')}
                    value={downloadSettings?.chapterFolderFormat || '{scanlator}_{chapter_name}'}
                    settingDescription={downloadSettings?.chapterFolderFormat || '{scanlator}_{chapter_name}'}
                    handleChange={(format) => updateSetting('chapterFolderFormat', format)}
                />
                <FormatVariablesList formatType="chapterFolderFormat" />

                <TextSetting
                    settingName={t('format.settings.cbz_file_format.label.title')}
                    dialogDescription={t('format.settings.cbz_file_format.label.description')}
                    value={downloadSettings?.cbzFileFormat || '{manga_title} - [{scanlator}] {chapter_name}'}
                    settingDescription={
                        downloadSettings?.cbzFileFormat || '{manga_title} - [{scanlator}] {chapter_name}'
                    }
                    handleChange={(format) => updateSetting('cbzFileFormat', format)}
                />
                <FormatVariablesList formatType="cbzFileFormat" />
            </List>

            {/* AniList Integration Section */}
            <List
                subheader={
                    <ListSubheader component="div" id="download-settings-anilist">
                        {t('anilist.settings.title')}
                    </ListSubheader>
                }
            >
                <ListItem>
                    <ListItemText
                        primary={t('anilist.settings.explanation')}
                        secondary={t('anilist.settings.explanation_detail')}
                    />
                </ListItem>

                <ListItem>
                    <ListItemText
                        primary={t('anilist.settings.enable.label')}
                        secondary={t('anilist.settings.enable.description')}
                    />
                    <Switch
                        edge="end"
                        checked={!!downloadSettings?.useAnilist}
                        onChange={(e) => updateSetting('useAnilist', e.target.checked)}
                    />
                </ListItem>

                <SelectSetting
                    disabled={!downloadSettings?.useAnilist}
                    settingName={t('anilist.settings.uncertain_action.label')}
                    dialogDescription={t('anilist.settings.uncertain_action.description')}
                    value={downloadSettings?.anilistDefaultUncertainAction || 'skip'}
                    handleChange={(action) => updateSetting('anilistDefaultUncertainAction', action as string)}
                    values={[
                        ['skip', { text: 'anilist.settings.uncertain_action.options.skip' }],
                        ['use', { text: 'anilist.settings.uncertain_action.options.use' }],
                    ]}
                />
            </List>

            <List
                subheader={
                    <ListSubheader component="div" id="download-settings-auto-delete-downloads">
                        {t('download.settings.delete_chapters.title')}
                    </ListSubheader>
                }
            >
                <ListItem>
                    <ListItemText primary={t('download.settings.delete_chapters.label.manually_marked_as_read')} />
                    <Switch
                        edge="end"
                        checked={metadataSettings.deleteChaptersManuallyMarkedRead}
                        onChange={(e) => updateMetadataSetting('deleteChaptersManuallyMarkedRead', e.target.checked)}
                    />
                </ListItem>
                <DeleteChaptersWhileReadingSetting
                    chapterToDelete={metadataSettings.deleteChaptersWhileReading}
                    handleChange={(chapterToDelete) =>
                        updateMetadataSetting('deleteChaptersWhileReading', chapterToDelete)
                    }
                />
                <ListItem>
                    <ListItemText primary={t('download.settings.delete_chapters.label.allow_deletion_of_bookmarked')} />
                    <Switch
                        edge="end"
                        checked={metadataSettings.deleteChaptersWithBookmark}
                        onChange={(e) => updateMetadataSetting('deleteChaptersWithBookmark', e.target.checked)}
                    />
                </ListItem>
            </List>
            <List
                subheader={
                    <ListSubheader component="div" id="download-settings-auto-download">
                        {t('download.settings.auto_download.title')}
                    </ListSubheader>
                }
            >
                <ListItem>
                    <ListItemText primary={t('download.settings.auto_download.label.new_chapters')} />
                    <Switch
                        edge="end"
                        checked={!!downloadSettings?.autoDownloadNewChapters}
                        onChange={(e) => updateSetting('autoDownloadNewChapters', e.target.checked)}
                    />
                </ListItem>
                <NumberSetting
                    disabled={!downloadSettings?.autoDownloadNewChapters}
                    settingTitle={t('download.settings.auto_download.download_limit.label.title')}
                    dialogDescription={t('download.settings.auto_download.download_limit.label.description')}
                    value={downloadSettings?.autoDownloadNewChaptersLimit ?? 0}
                    settingValue={
                        !downloadSettings.autoDownloadNewChaptersLimit
                            ? t('global.label.none')
                            : t('download.settings.download_ahead.label.value', {
                                  chapters: downloadSettings.autoDownloadNewChaptersLimit,
                                  count: downloadSettings.autoDownloadNewChaptersLimit,
                              })
                    }
                    defaultValue={0}
                    minValue={0}
                    maxValue={20}
                    showSlider
                    valueUnit={t('chapter.title_one')}
                    handleUpdate={(autoDownloadNewChaptersLimit) =>
                        updateSetting('autoDownloadNewChaptersLimit', autoDownloadNewChaptersLimit)
                    }
                />
                <ListItem>
                    <ListItemText primary={t('download.settings.auto_download.label.ignore_with_unread_chapters')} />
                    <Switch
                        edge="end"
                        checked={!!downloadSettings?.excludeEntryWithUnreadChapters}
                        onChange={(e) => updateSetting('excludeEntryWithUnreadChapters', e.target.checked)}
                        disabled={!downloadSettings?.autoDownloadNewChapters}
                    />
                </ListItem>
                <ListItem>
                    <ListItemText primary={t('download.settings.auto_download.label.ignore_re_uploads')} />
                    <Switch
                        edge="end"
                        checked={!!downloadSettings?.autoDownloadIgnoreReUploads}
                        onChange={(e) => updateSetting('autoDownloadIgnoreReUploads', e.target.checked)}
                        disabled={!downloadSettings?.autoDownloadNewChapters}
                    />
                </ListItem>
                <CategoriesInclusionSetting
                    categories={categories.data!.categories.nodes}
                    includeField="includeInDownload"
                    dialogText={t('download.settings.auto_download.categories.label.include_in_download')}
                />
            </List>
            <List
                subheader={
                    <ListSubheader component="div" id="download-settings-download-ahead">
                        {t('download.settings.download_ahead.title')}
                    </ListSubheader>
                }
            >
                <DownloadAheadSetting downloadAheadLimit={metadataSettings.downloadAheadLimit} />
            </List>
        </List>
    );
};
