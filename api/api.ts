import { PLUGIN_NAME } from './../constants';
import { Mutex, withTimeout } from 'async-mutex';
import { get, mapKeys } from 'lodash';
import Tools5eTagLinkPlugin from "main";
import { App, Notice } from "obsidian";
import Tools5eTagLinkPluginSettings from 'settings/settings';
import Parser from './sources';

export class Api {
    app: App;
    settings: Tools5eTagLinkPluginSettings;

    fileCache = new Map<string, any>();
    fileCacheLock = withTimeout(new Mutex(), 2000);

    dataCache = new Map<string, any>();
    dataCacheLock = withTimeout(new Mutex(), 100);

    homebrewIndex: Record<string, string> = {};

    initialize(plugin: Tools5eTagLinkPlugin) {
        this.app = plugin.app;
        this.settings = plugin.settings;

        this.getHomebrewIndex();
    }

    async clearCache() {
        new Notice(`${PLUGIN_NAME}: Clearing cached data...`);
        this.fileCache = new Map<string, any>();
        this.fileCacheLock.release();

        this.dataCache = new Map<string, any>();
        this.dataCacheLock.release();

        this.homebrewIndex = {};
        await this.getHomebrewIndex();
    }

    get rawHomebrewRepoUrl() {
        return this.settings.getOrDefault('homebrewRepoUrl').replace('github.com', 'raw.githubusercontent.com');
    }

    async getHomebrewIndex() {
        const url = this.rawHomebrewRepoUrl + '/_generated/index-sources.json';
        try {
            const data = await (await fetch(url)).json();
            this.homebrewIndex = mapKeys(data, (v, k) => k.toLowerCase());
        } catch (err) {
            new Notice(`${PLUGIN_NAME}: Could not get homebrew index from url '${url}'. Check your settings`);
        }
    }

    async downloadData(tag: string, source: string, hash: string, name: string) {
        const getJsonFiles = async (tag: string, source: string) => {
            tag = tag.replace('@', '');
            source = source.toLowerCase();

            const brewSource = this.homebrewIndex[source];
            if (brewSource) {
                const releaseFileCache = await this.fileCacheLock.acquire();
                try {
                    if (!this.fileCache.has(brewSource)) {
                        const url = this.rawHomebrewRepoUrl + '/' + brewSource;
                        try {
                            const data = await (await fetch(url)).json();
                            this.fileCache.set(brewSource, data);
                        } catch (err) {
                            this.fileCache.set(brewSource, null);
                            new Notice(`${PLUGIN_NAME}: Could not get homebrew '${brewSource}'`);
                        }
                    }
                } finally {
                    releaseFileCache();
                }
                return [{ filename: brewSource.split('/').slice(-1), file: this.fileCache.get(brewSource) }]
            } else {
                const filenames = getFilenamesByTag(tag, source);
                const releaseFileCache = await this.fileCacheLock.acquire();
                try {
                    for (const filename of filenames) {
                        if (!this.fileCache.has(filename)) {
                            try {
                                const url = this.settings.getOrDefault('tools5eUrl') + 'data/' + filename;
                                const data = await (await fetch(url)).json();
                                this.fileCache.set(filename, data);
                            } catch (err) {
                                this.fileCache.set(filename, null);
                                new Notice(`${PLUGIN_NAME}: Could not get json '${filename}'`);
                            }
                        }
                    }
                } finally {
                    releaseFileCache();
                }
                return filenames.map((filename) => ({ filename: filename.split('/').slice(-1), file: this.fileCache.get(filename) }));

                function getFilenamesByTag(tag: string, source: string) {
                    switch (tag) {
                        case 'item':
                            return [`items.json`, 'items-base.json', `magicvariants.json`];
                        case 'spell':
                            return [`spells/spells-${source}.json`];
                        case 'creature':
                            return [`bestiary/bestiary-${source}.json`];
                        default:
                            return [];
                    }
                }
            }
        }

        const getData = async (fileData: any[], hash: string, name: string, source: string) => {
            const releaseDataCache = await this.dataCacheLock.acquire();
            try {
                if (!this.dataCache.has(hash)) {
                    const data = fileData ? getDataByTag(tag, fileData, name, source) : null;
                    if (data) this.dataCache.set(hash, data);
                }
                return this.dataCache.get(hash);
            } finally {
                releaseDataCache();
            }

            function getDataByTag(tag: string, fileData: any[], name: string, source: string) {
                const findByNameAndSource = <T extends { name: string; source: string | undefined; srd: string | boolean | undefined }>(data: any[], paths: string[]) => {
                    let entry: any = undefined;
                    let sourceInfo: { abbr: string, fullname?: string } = { abbr: source.toLowerCase() };
                    data.some(d => paths.some(p => {
                        const dataAtPath = get(d, p) as T[];
                        if (!dataAtPath) return false;

                        dataAtPath.some(x => {
                            const found = (x.name.toLowerCase() === name.toLowerCase() || (x.srd && typeof (x.srd) === 'string' ? x.srd.toLowerCase() === name.toLowerCase() : false)) && (!x.source || x.source.toLowerCase() === source.toLowerCase());
                            if (found) {
                                entry = x;

                                const brewSources = d._meta?.sources as { json: string, abbreviation: string, full: string }[] | undefined;
                                if (brewSources && entry.source) {
                                    const brewSource = brewSources.find(x => x.json === entry.source);
                                    if (brewSource) {
                                        sourceInfo = { abbr: brewSource.abbreviation, fullname: brewSource.full }
                                    }
                                } else if (entry.source) {
                                    const wotcSource = Parser.SOURCE_JSON_TO_FULL[entry.source];
                                    if (wotcSource) {
                                        sourceInfo = { abbr: entry.source, fullname: wotcSource };
                                    }
                                }
                            }
                            return found;
                        })
                    }));
                    return { entry, sourceInfo };
                }

                switch (tag) {
                    case '@item':
                        return findByNameAndSource(fileData, ['item', 'itemGroup', 'itemEntry', 'baseitem', 'magicvariant']);
                    case '@creature':
                        return findByNameAndSource(fileData, ['monster']);
                    case '@spell':
                        return findByNameAndSource(fileData, ['spell']);
                    default:
                        throw new Error(`tag '${tag}' not supported`);
                }
            }
        }

        const files = await getJsonFiles(tag, source);
        if (!files) throw new Error(`not found`);
        if (!files.length) return { entry: undefined, sourceInfo: undefined };

        const data = await getData(files.flatMap(x => x.file), hash, name, source);
        if (!data.entry) throw new Error(`not found`);

        return data;
    }
}