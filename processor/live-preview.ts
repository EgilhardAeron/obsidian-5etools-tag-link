import { syntaxTree } from "@codemirror/language";
import { EditorSelection, Range, StateEffect, StateField, Text } from "@codemirror/state";
import {
    type DecorationSet,
    Decoration,
    EditorView,
    ViewPlugin,
    ViewUpdate,
    WidgetType,
} from "@codemirror/view";
import { type SyntaxNode } from '@lezer/common';
import { createHash, Hash } from "crypto";
import { flatten } from "lodash";
import Tools5eTagLinkPlugin from "main";
import {
    editorLivePreviewField
} from "obsidian";

function selectionAndRangeOverlap(
    selection: EditorSelection,
    rangeFrom: number,
    rangeTo: number
) {
    for (const range of selection.ranges) {
        if (range.from <= rangeTo && range.to >= rangeFrom) {
            return true;
        }
    }
    return false;
}

const RenderResultEffects = StateEffect.define<DecorationSet>();

export const renderResultField = StateField.define<DecorationSet>({
    create(state) {
        return Decoration.none;
    },
    update(value, tr) {
        for (let effect of tr.effects) {
            if (effect.is(RenderResultEffects)) {
                return effect.value
            }
        }
        return value
    },
    provide(field: StateField<DecorationSet>) {
        return EditorView.decorations.from(field);
    },
});

export function inlinePlugin(plugin: Tools5eTagLinkPlugin) {
    return ViewPlugin.fromClass(
        class {
            async update(update: ViewUpdate) {
                if (!update.state.field(editorLivePreviewField)) {
                    setTimeout(() => {
                        update.view.dispatch({
                            effects: RenderResultEffects.of(Decoration.none)
                        })
                    }, 20);
                    return;
                }

                if (
                    update.docChanged ||
                    update.viewportChanged ||
                    update.selectionSet
                ) {

                    const currentFile = plugin.app.workspace.getActiveFile();
                    if (!currentFile) return;

                    const typeRegex = new RegExp(".*?_?inline-code_?.*");
                    const regex = new RegExp("^\{.*\}$");
                    const nodesInRange = new Set<{ node: SyntaxNode, text: string }>();
                    update.view.visibleRanges.forEach(({ from, to }) => {
                        syntaxTree(update.view.state).iterate(({
                            from,
                            to,
                            enter: ({ node }) => {
                                const type = node.type;
                                if (type.name.includes("formatting")) return;
                                if (!typeRegex.test(type.name)) return;
                                const text = update.view.state.doc.sliceString(node.from, node.to);

                                if (!regex.test(text)) return;
                                nodesInRange.add({ node, text });
                            }
                        }))
                    });

                    const selection = update.view.state.selection;
                    const widgets = await Promise.all(Array.from(nodesInRange).map(async ({ node, text }) => {
                        const widgetsInNode: Range<Decoration>[] = [];
                        const links = await plugin.processor.getLinks(text);

                        for (const link of links) {
                            const start = node.from;
                            let end = node.to;
                            widgetsInNode.push(Decoration.mark({ attributes: { style: "font-weight: 700; font-style: italic;" } }).range(start, end));

                            const overlaps = selectionAndRangeOverlap(selection, start, end);
                            if (overlaps) {
                                // widgetsInNode.push(Decoration.mark({ attributes: { style: "background-color: yellow;" } }).range(start -1 , end + 1));
                                continue;
                            }

                            const tagWidget = new TagWidget(link.spanTag);
                            if (link.anchor) end = end - 1;
                            widgetsInNode.push(Decoration.replace({ widget: tagWidget, }).range(start, end));

                            if (link.anchor) {
                                const anchorWidget = new AnchorWidget(link.anchor);
                                widgetsInNode.push(Decoration.replace({ widget: anchorWidget, }).range(end, end + 1));
                            }
                        }
                        return widgetsInNode;
                    }));

                    const decorations = Decoration.set(flatten(widgets), true);
                    update.view.dispatch({
                        effects: RenderResultEffects.of(decorations)
                    })
                }
            }
        },
    );
}



export class TagWidget extends WidgetType {
    readonly hash: string;

    constructor(
        private readonly spanTag: HTMLElement,
    ) {
        super();
        this.hash = createHash('sha256').update(this.spanTag.outerHTML).digest('base64');
    }

    eq(other: WidgetType) {
        if (!(other instanceof AnchorWidget)) return false;
        return this.hash === other.hash;
    }

    toDOM(view: EditorView): HTMLElement {
        const span = createSpan()
        span.innerHTML = `${this.spanTag.outerHTML}`;
        return span;
    }

    ignoreEvent(event: Event): boolean {
        return false;
    }
}

export class AnchorWidget extends WidgetType {
    readonly hash: string;

    constructor(
        private anchor: HTMLElement
    ) {
        super();
        this.hash = createHash('sha256').update(this.anchor.outerHTML).digest('base64');
    }

    eq(other: WidgetType) {
        if (!(other instanceof AnchorWidget)) return false;
        return this.hash === other.hash;
    }

    toDOM(view: EditorView): HTMLElement {
        const span = createSpan()
        span.innerHTML = `${this.anchor.outerHTML}`;
        return span;
    }
}