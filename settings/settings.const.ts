import { PLUGIN_NAME } from "../constants";
import { Tools5eTagLinkPluginSettings } from "./settings.types";

export const DEFAULT_SETTINGS: Tools5eTagLinkPluginSettings = {
	mode: 'opengate',
	tools5eUrl: 'https://5e.tools/',
	homebrewRepoUrl: 'https://github.com/TheGiddyLimit/homebrew/master',
	hideIcons: false,
	openGateId: '5etools',
	openGateTitle: PLUGIN_NAME,
	openGateIcon: '',
	openGateCss: `@media screen and (width <=991px) {
    .container {
      display: flex !important;
      flex-direction: column
    }

    #listcontainer {
      order: 2;
    }
  }`,
	ignoredTags: [],
}
