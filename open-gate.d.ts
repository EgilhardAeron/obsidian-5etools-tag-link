// From: https://github.com/nguyenvanduocit/obsidian-open-gate/blob/main/src/main.ts
export type GateFrameOptionType = 'left' | 'center' | 'right'

export type GateFrameOption = {
    id: string
    icon: string // SVG code or icon id from lucide.dev
    title: string // Gate frame title
    url: string // Gate frame URL
    profileKey?: string // Similar to a Chrome profile
    hasRibbon?: boolean // If true, icon appears in the left sidebar
    position?: GateFrameOptionType // 'left', 'center', or 'right'
    userAgent?: string // User agent for the gate frame
    zoomFactor?: number // Zoom factor (0.5 = 50%, 1.0 = 100%, 2.0 = 200%, etc.)
    css?: string // Custom CSS for the gate frame
    js?: string // Custom JavaScript for the gate frame
}

type OpenGatePlugin = { 
	findGateBy(field: keyof GateFrameOption, value: string): GateFrameOption | undefined,
	addGate(gate: GateFrameOption): Promise<void>;
}