import { PLUGIN_NAME } from './constants';
import { isEqual, pick } from 'lodash';
import { Notice, Plugin } from 'obsidian';
import { OpenGatePlugin } from 'open-gate';
import { inlinePlugin, renderResultField } from 'processor/live-preview';
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
		this.registerEditorExtension([inlinePlugin(this), renderResultField]);
	}	

	async onunload() {
		await this.processor.api.clearCache()
	}

	async loadSettings() {
		if (this.settings.getOrDefault('mode') === 'opengate') {
			const opengatePlugin = await this.getPlugin<OpenGatePlugin>('open-gate');
			switch (true) {
				case opengatePlugin === undefined: {
					new Notice(`${PLUGIN_NAME}: Could not inspect plugins... No further action taken.`);
					break;
				}
				case opengatePlugin === null: {
					new Notice(`${PLUGIN_NAME}: No open-gate plugin found! Fallbacking to 'link' mode...`);
					this.settings.set('mode', 'link');
					break;
				}
				default: {
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
						}
					}
				}
			}
		}
	}

	async saveSettings() {
		await this.saveData(this.settings.values());
		await this.loadSettings();
	}

	private async getPlugin<TPlugin extends { id: string; }>(id: string): Promise<TPlugin | null | undefined> {
		try {
			const plugin = Object.entries((this.app as any).plugins.plugins).find(([key]) => key === id)?.[1] ?? null;
			return plugin as TPlugin | null;
		} catch (err) {
			return undefined;
		}
	}
}




