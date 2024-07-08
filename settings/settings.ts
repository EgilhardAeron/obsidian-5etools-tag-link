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

        new Setting(containerEl)
            .setName('Mode')
            .setDesc('')
            .addDropdown(cb => cb
                .addOption('link', 'Link').addOption('opengate', ' Open Gate')
                .setValue(this.plugin.settings.get('mode'))
                .onChange(debounce(async (value: 'link' | 'opengate') => {
                    this.plugin.settings.set('mode', value);
                    await this.plugin.saveSettings();
                })));

        new Setting(containerEl)
            .setName('5eTools Url (Optional)')
            .setDesc('The URL of your 5etools mirror')
            .addText(text => text
                .setPlaceholder(DEFAULT_SETTINGS.tools5eUrl)
                .setValue(this.plugin.settings.get('tools5eUrl'))
                .onChange(debounce(async (value: string) => {
                    this.plugin.settings.set('tools5eUrl', value);
                    await this.plugin.saveSettings();
                })));

        new Setting(containerEl)
            .setName('Open Gate Id (Optional)')
            .setDesc('The id of the 5etools open gate')
            .addText(text => text
                .setPlaceholder(DEFAULT_SETTINGS.openGateId)
                .setValue(this.plugin.settings.get('openGateId'))
                .onChange(debounce(async (value: string) => {
                    this.plugin.settings.set('openGateId', value);
                    await this.plugin.saveSettings();
                })));

        new Setting(containerEl)
            .setName('Open Gate Title (Optional)')
            .setDesc('The title of the 5etools open gate')
            .addText(text => text
                .setPlaceholder(DEFAULT_SETTINGS.openGateTitle)
                .setValue(this.plugin.settings.get('openGateTitle'))
                .onChange(debounce(async (value: string) => {
                    this.plugin.settings.set('openGateTitle', value);
                    await this.plugin.saveSettings();
                })));

    }
}