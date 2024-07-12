import { debounce, isEmpty } from "lodash";
import Tools5eTagLinkPlugin from "main";
import { App, PluginSettingTab, Setting } from "obsidian";
import { DEFAULT_SETTINGS } from "./settings.const";
import { Tools5eTagLinkPluginSettings } from "./settings.types";

export default class Settings {
    private readonly _values: Tools5eTagLinkPluginSettings;

    constructor(values: Tools5eTagLinkPluginSettings) {
        this._values = Object.assign({}, DEFAULT_SETTINGS, values)
    }

    values() {
        return this._values;
    }

    get<TKey extends keyof Tools5eTagLinkPluginSettings>(key: TKey) {
        return this._values[key];
    }

    set<TKey extends keyof Tools5eTagLinkPluginSettings>(key: TKey, value: Tools5eTagLinkPluginSettings[TKey]) {
        this._values[key] = value;
    }

    getOrDefault<TKey extends keyof Tools5eTagLinkPluginSettings>(key: TKey) {
        return !isEmpty(this._values[key]) ? this._values[key] : DEFAULT_SETTINGS[key];
    }
}

export class Tools5eTagLinkPluginSettingsTab extends PluginSettingTab {
    plugin: Tools5eTagLinkPlugin;

    constructor(app: App, plugin: Tools5eTagLinkPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;

        containerEl.empty();

        const createModeDesc = () => {
            const fragment = createFragment();
            const div = createEl('div');
            div.innerHTML = `<ul>
                <li><b>Link</b> will open the page in your browser.
                <li><b>Open Gate</b> will open the page in Obsidian. <em>Requires the 'Open Gate' plugin</em>.
            </ul>`
            fragment.appendChild(div);
            return fragment;
        }

        new Setting(containerEl)
            .setName('Mode')
            .setDesc(createModeDesc())
            .addDropdown(cb => cb
                .addOption('link', 'Link').addOption('opengate', ' Open Gate')
                .setValue(this.plugin.settings.get('mode'))
                .onChange(debounce(async (value: 'link' | 'opengate') => {
                    this.plugin.settings.set('mode', value);
                    await this.plugin.saveSettings();
                })));

        new Setting(containerEl)
            .setName('Hide icons')
            .setDesc('Hide the icons that show on supported tags.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.get('hideIcons'))
                .onChange(debounce(async (value: boolean) => {
                    this.plugin.settings.set('hideIcons', value);
                    await this.plugin.saveSettings();
                })));


        new Setting(containerEl)
            .setName('5eTools url (Optional)')
            .setDesc('The URL of your 5etools instance.')
            .addText(text => text
                .setPlaceholder(DEFAULT_SETTINGS.tools5eUrl)
                .setValue(this.plugin.settings.get('tools5eUrl'))
                .onChange(debounce(async (value: string) => {
                    this.plugin.settings.set('tools5eUrl', value);
                    await this.plugin.saveSettings();
                })));

        new Setting(containerEl)
            .setName('Homebrew repository url (Optional)')
            .setDesc('The URL of your homebrew repository (must be on GitHub).')
            .addText(text => text
                .setPlaceholder(DEFAULT_SETTINGS.homebrewRepoUrl)
                .setValue(this.plugin.settings.get('homebrewRepoUrl'))
                .onChange(debounce(async (value: string) => {
                    this.plugin.settings.set('homebrewRepoUrl', value);
                    await this.plugin.saveSettings();
                })));

        new Setting(containerEl)
            .setName('Open Gate id (Optional)')
            .setDesc('The id of the 5etools open gate.')
            .addText(text => text
                // .setDisabled(this.plugin.settings.getOrDefault('mode') !== 'opengate')
                .setPlaceholder(DEFAULT_SETTINGS.openGateId)
                .setValue(this.plugin.settings.get('openGateId'))
                .onChange(debounce(async (value: string) => {
                    this.plugin.settings.set('openGateId', value);
                    await this.plugin.saveSettings();
                })));

        new Setting(containerEl)
            .setName('Open Gate title (Optional)')
            .setDesc('The title of the 5etools open gate.')
            .addText(text => text
                // .setDisabled(this.plugin.settings.getOrDefault('mode') !== 'opengate')
                .setPlaceholder(DEFAULT_SETTINGS.openGateTitle)
                .setValue(this.plugin.settings.get('openGateTitle'))
                .onChange(debounce(async (value: string) => {
                    this.plugin.settings.set('openGateTitle', value);
                    await this.plugin.saveSettings();
                })));

        new Setting(containerEl)
            .setName('Clear cache')
            .setDesc('Remove all cached data.')
            .addButton(btn => btn
                .setIcon('trash')
                .setWarning()
                .onClick(async () => {
                    await this.plugin.processor.api.clearCache();
                }));

    }
}