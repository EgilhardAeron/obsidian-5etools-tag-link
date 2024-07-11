import Tools5eTagLinkPlugin from "main";
import { App, Component, MarkdownPostProcessorContext } from "obsidian";
import Tools5eTagLinkPluginSettings from 'settings/settings';
import { Renderer as Renderer_ } from '../5etools/js/render';

const Renderer: typeof Renderer_ & {
    splitByTags: (arg: string) => string[];
    splitFirstSpace: (arg: string) => string[];
    utils: { getTagMeta: (tag: string, text: string) => { name: string, page: string, hash: string, displayText: string | null } };
} = Renderer_ as any;

export class TagProcessor extends Component {
    app: App;
    settings: Tools5eTagLinkPluginSettings;

    initialize(plugin: Tools5eTagLinkPlugin) {
        this.app = plugin.app;
        this.settings = plugin.settings;
    }

    async postprocessor(element: HTMLElement, context: MarkdownPostProcessorContext) {
        const entries = element.findAll("p, li, td");

        for (let entry of entries) {
            const links = this.getLinks(entry.innerHTML);

            for (let i = 0; i < entry.childNodes.length; i++) {
                const childNode = entry.childNodes.item(i);
                if (!childNode.nodeValue) continue;

                let anyChange = false;
                for (const { tagText, span } of links) {
                    if (!childNode.nodeValue.contains(tagText)) continue;
                    anyChange = true;
                    childNode.nodeValue = childNode.nodeValue.replace(tagText, span.outerHTML);

                }
                if (anyChange) {
                    const newSpan = createSpan();
                    newSpan.innerHTML = childNode.nodeValue;
                    childNode.replaceWith(newSpan);
                }
            }
        }
    }

    getLinks(content: string) {
        if (!content) return [];
        const tagsInText = Renderer.splitByTags(content).filter((x: string) => x.startsWith('{@'));
        if (!tagsInText.length) return [];

        let currentPos = 0;
        const links = tagsInText.map((tagText) => {
            const start = content.indexOf(tagText, currentPos);
            const end = tagText.endsWith("}") ? start + tagText.length : start + 2;
            currentPos = end;

            let [tag, text] = Renderer.splitFirstSpace(tagText.slice(1, -1));
            tag = this.fixTag(tag);
            text = this.fixText(text);

            try {
                const { name, page, hash, displayText } = Renderer.utils.getTagMeta(tag, text);
                const baseUrl = this.generateBaseUrl(tag, page, hash);
                const url = this.generateUrl(baseUrl);
                const icon = this.getIcon(tag);
                const { color = "Black", hoverColor = "DarkSlateGray", bgColor = 'LightGray' } = this.getColors(tag);
                const shortenedTagText = this.shortenTagText(tagText, displayText);

                const span = createSpan();
                span.setAttribute('style', `background-color: ${bgColor}; padding: 2px 4px; border-radius: 4px; `);
                span.innerHTML = `<a 
                    onmouseover="this.style.color='${hoverColor}'" 
                    onmouseout="this.style.color='${color}'" 
                    style="color: ${color};" 
                    href="${url}"
                >${icon ? icon + ' ' : ''}${displayText ?? name}</a>`;
                return { tagText, tag, text, span, displayText, shortenedTagText, start, end };
            } catch (err) {
                const span = createSpan()
                span.innerHTML = text;
                return { tagText, tag, text, span, displayText: null, shortenedTagText: null, start, end }
            }
        });

        return links;
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
        return text.replace(/;/g, '|');
    }

    private shortenTagText(tagText: string, displayText: string|null) {
        if (!displayText) return displayText;

        let str = tagText;
        str = str.substring(1, str.lastIndexOf(displayText) - 1);
        str = str.endsWith(';') ? str.substring(0, str.length - 1) : str;
        str = `{${str}}`;
        return str;
    }

    private getColors(tag: string): { color?: string, hoverColor?: string, bgColor?: string } {
        switch (tag) {
            case '@creature':
                return { bgColor: `LightBlue` };
            case '@item':
                return { bgColor: `Khaki` };
            case '@spell':
                return { bgColor: `RebeccaPurple`, color: `White`, hoverColor: `LightGray` };
            default:
                return {};
        }
    }

    private getIcon(tag: string) {
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