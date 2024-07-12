import { Api } from "api/api";
import Tools5eTagLinkPlugin from "main";
import { App, Component, MarkdownPostProcessorContext } from "obsidian";
import Tools5eTagLinkPluginSettings from 'settings/settings';

import { Renderer as Renderer_ } from '../5etools/js/render';
import { PLUGIN_NAME } from "../constants";

const Renderer: typeof Renderer_ & {
    splitByTags: (arg: string) => string[];
    splitFirstSpace: (arg: string) => string[];
    utils: { getTagMeta: (tag: string, text: string) => { name: string, page: string, source: string, hash: string, displayText: string | null } };
} = Renderer_ as any;

export class TagProcessor extends Component {
    app: App;
    settings: Tools5eTagLinkPluginSettings;
    api: Api;

    initialize(plugin: Tools5eTagLinkPlugin) {
        this.app = plugin.app;
        this.settings = plugin.settings;
        this.api = new Api();
        this.api.initialize(plugin);
    }

    async postprocessor(element: HTMLElement, context: MarkdownPostProcessorContext) {
        const entries = element.findAll("code");

        for (let entry of entries) {
            if (!entry.innerHTML) continue;
            const links = await this.getLinks(entry.innerHTML);

            for (const { tagText, spanTag, anchor } of links) {
                const newSpan = createSpan();
                newSpan.innerHTML = entry.innerHTML.replace(tagText, `${spanTag.outerHTML}${anchor ? anchor.outerHTML : ''}`);
                entry.replaceWith(newSpan);
            }
        }
    }

    async getLinks(content: string) {
        if (!content) return [];
        const tagsInText = Renderer.splitByTags(content).filter((x: string) => x.startsWith('{@'));
        if (!tagsInText.length) return [];

        let currentPos = 0;
        const links = await Promise.all(tagsInText
            .filter(tagText => tagText.endsWith("}"))
            .map(async (tagText) => {
                const start = content.indexOf(tagText, currentPos);
                const end = start + tagText.length;
                currentPos = end;

                let [tag, text] = Renderer.splitFirstSpace(tagText.slice(1, -1));
                tag = this.fixTag(tag);
                text = this.fixText(text);

                try {
                    if (!text) throw new Error(`No tag text`);

                    let { name, page, source, hash, displayText } = Renderer.utils.getTagMeta(tag, text);
                    const dataResult = await this.api.downloadData(tag, source, hash, name);
                    const { entry: data, sourceInfo } = dataResult;
                    if (data) {
                        hash = this.fixHash(hash, data);
                    }

                    const baseUrl = this.generateBaseUrl(tag, page, hash);
                    const url = this.generateUrl(baseUrl);
                    const icon = this.getIcon(tag);
                    const { color = "Black", bgColor = 'LightGray' } = this.getColors(tag);
                    const shortenedTagText = this.shortenTagText(tagText, displayText);

                    const spanTag = createSpan();
                    spanTag.setAttribute('style', `background-color: ${bgColor}; color: ${color}; padding: 2px 4px; border-radius: 4px; `);
                    spanTag.innerHTML = `${icon ? icon + ' ' : ''}${displayText ?? name ?? ''}${sourceInfo ? ' ' : ''}`;

                    if (sourceInfo) {
                        const { abbr, fullname } = sourceInfo;
                        const abbrSource = spanTag.createEl('abbr');
                        abbrSource.setAttribute('style', `font-size: smaller; font-variant: small-caps; text-decoration-thickness: 1px;`);
                        if (fullname) {
                            abbrSource.setAttribute('title', fullname);
                        }
                        abbrSource.innerHTML = `<small>${abbr}</small>`;
                    }

                    const anchor = createEl('button');
                    anchor.setAttribute('onclick', `location.href = "${url}"`);
                    anchor.setAttribute('class', `clickable-icon`);
                    anchor.setAttribute('style', `display: inline; font-weight: 700; color: #777777`);
                    anchor.innerHTML = `⧉`;

                    return { tagText, tag, text, spanTag, anchor, displayText, shortenedTagText, start, end };
                } catch (err) {
                    console.log(`${PLUGIN_NAME} error`, err);
                    const spanTag = createSpan()
                    spanTag.setAttribute('style', `background-color: IndianRed; padding: 2px 4px; border-radius: 4px; `);
                    spanTag.innerHTML = `${text} ⚠️ ${err.message}`;
                    return { tagText, tag, text, spanTag, anchor: null, displayText: null, shortenedTagText: null, start, end, err }
                }
            }));

        return links;
    }

    fixHash(hash: string, data: any): string {
        if (!(data.srd && typeof data.srd === 'string')) return hash;
        const [pageHash, sourceHash] = hash.split('_');
        return `${encodeURIComponent(data.name.toLowerCase())}_${sourceHash}`;
    }

    private fixTag(tag: string) {
        switch (tag) {
            case '@monster':
                return '@creature';
            case '@classtype':
                return '@class';
            default:
                return tag;
        }
    }

    private fixText(text: string) {
        return text.replace(/\\/g, '');
    }

    private shortenTagText(tagText: string, displayText: string | null) {
        if (!displayText) return displayText;

        let str = tagText;
        str = str.substring(1, str.lastIndexOf(displayText) - 1);
        str = str.endsWith(';') ? str.substring(0, str.length - 1) : str;
        str = `{${str}}`;
        return str;
    }

    private getColors(tag: string): { color?: string, bgColor?: string } {
        switch (tag) {
            case '@creature':
                return { bgColor: `LightBlue` };
            case '@item':
                return { bgColor: `Khaki` };
            case '@spell':
                return { bgColor: `RebeccaPurple`, color: `White` };
            default:
                return {};
        }
    }

    private getIcon(tag: string) {
        if (this.settings.get('hideIcons')) return null;
        switch (tag) {
            case '@creature':
                return `👤`;
            case '@item':
                return `🗡️`;
            case '@spell':
                return `🪄`;
            default:
                return null;
        }
    }

    private generateBaseUrl(tag: string, page: string, hash: string) {
        switch (true) {
            case tag === '@skill':
                return `${this.settings.getOrDefault('tools5eUrl')}/quickreference.html#bookref-quick,2,skills`;
            case tag === '@sense':
                return `${this.settings.getOrDefault('tools5eUrl')}/quickreference.html#bookref-quick,2,vision and light`;
            default:
                return `${this.settings.getOrDefault('tools5eUrl')}/${page}#${hash}`;
        }
    }

    private generateUrl(baseUrl: string) {
        const cleanurl = baseUrl.replace(/([^:]\/)\/+/g, "$1");
        switch (this.settings.getOrDefault('mode')) {
            case 'link':
                return cleanurl;
            case 'opengate': {
                return `obsidian://opengate?id=${this.settings.getOrDefault('openGateId')}&title=${encodeURIComponent(this.settings.getOrDefault('openGateTitle'))}&url=${encodeURIComponent(cleanurl)}`;
            }
        }
    }
}