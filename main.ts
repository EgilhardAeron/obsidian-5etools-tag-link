import { isEqual, pick } from 'lodash';
import { Notice, Plugin } from 'obsidian';
import type { OpenGatePlugin } from 'open-gate';
import { inlinePlugin } from 'processor/live-preview';
import { TagProcessor } from 'processor/processor';
import Tools5eTagLinkPluginSettings, { Tools5eTagLinkPluginSettingsTab } from 'settings/settings';

export default class Tools5eTagLinkPlugin extends Plugin {
	settings: Tools5eTagLinkPluginSettings;
	processor: TagProcessor;

	async onload() {
		this.settings = new Tools5eTagLinkPluginSettings(await this.loadData());
		this.addSettingTab(new Tools5eTagLinkPluginSettingsTab(this.app, this));

		this.app.workspace.onLayoutReady(async () => {
			await this.loadSettings();
		});

		this.processor = new TagProcessor();
		this.processor.initialize(this);

		this.registerMarkdownPostProcessor((element, context) => {
			this.processor.postprocessor(element, context)
		});
		this.registerEditorExtension([inlinePlugin(this)]);
	}

	onunload() {

	}

	async loadSettings() {
		if (this.settings.getOrDefault('mode') === 'opengate') {
			const opengatePlugin = await this.getOpenGatePlugin();
			if (!opengatePlugin) {
				new Notice(`No open-gate plugin found! Fallbacking to 'link' mode...`);
				this.settings.set('mode', 'link');
			} else {

				const settingsGate = {
					id: this.settings.getOrDefault('openGateId'),
					icon: this.settings.getOrDefault('openGateIcon'),
					title: this.settings.getOrDefault('openGateTitle'),
					url: this.settings.getOrDefault('tools5eUrl'),
					profileKey: this.settings.getOrDefault('openGateId'),
					css: this.settings.getOrDefault('openGateCss'),
					hasRibbon: true,
				};

				const gate = opengatePlugin.findGateBy('id', settingsGate.id);
				if (!gate) {
					opengatePlugin.addGate(settingsGate);
				} else {
					const fields = ['id', 'title', 'url', 'profileKey'];
					if (!isEqual(pick(gate, fields), pick(settingsGate, fields))) {
						opengatePlugin.addGate(settingsGate);
					} else {
						new Notice(`Gate '${settingsGate.title}' configured successfully!`);
					}
				}
			}
		}
	}

	async saveSettings() {
		await this.saveData(this.settings.values());
		await this.loadSettings();
	}

	private async getOpenGatePlugin() {
		const plugin: OpenGatePlugin | undefined = (this.app as any).plugin?.plugins?.["open-gate"];
		return plugin;
	}
}




