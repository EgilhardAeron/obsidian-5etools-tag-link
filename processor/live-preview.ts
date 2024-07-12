import { syntaxTree } from "@codemirror/language";
import { EditorSelection, Range } from "@codemirror/state";
import {
    type DecorationSet,
    Decoration,
    EditorView,
    ViewPlugin,
    ViewUpdate,
    WidgetType
} from "@codemirror/view";
import { type SyntaxNode } from '@lezer/common';
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
        if (range.from <= rangeTo + 1 && range.to >= rangeFrom - 1) {
            return true;
        }
    }
    return false;
}

export function inlinePlugin(plugin: Tools5eTagLinkPlugin) {
    return ViewPlugin.fromClass(
        class {
            decorations: DecorationSet;

            constructor(view: EditorView) {
                this.decorations = Decoration.none;
            }

            async update(update: ViewUpdate) {
                if (!update.state.field(editorLivePreviewField)) {
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
                            const end = node.to;
                            widgetsInNode.push(Decoration.mark({ attributes: { style: "font-weight: 700; font-style: italic;" } }).range(start, end));

                            const overlaps = selectionAndRangeOverlap(selection, start, end);
                            if (overlaps) {
                                // widgetsInNode.push(Decoration.mark({ attributes: { style: "background-color: yellow;" } }).range(start -1 , end + 1));
                                continue;
                            }

                            const tagWidget = new TagWidget(link.spanTag);
                            widgetsInNode.push(Decoration.replace({ widget: tagWidget }).range(start, end));

                            if (link.anchor) {
                                // handle nested code blocks
                                const after = update.view.state.doc.sliceString(node.to);
                                const count = (() => {
                                    let i = 0;
                                    while (i < after.length) {
                                        if (after[i] !== '`') return i;
                                        i++;
                                    }
                                    return 0;
                                })();
                                const anchorWidget = new AnchorWidget(link.anchor);
                                widgetsInNode.push(Decoration.widget({ widget: anchorWidget }).range(end + count));
                            }
                        }
                        return widgetsInNode;
                    }));

                    const decorations = Decoration.set(flatten(widgets), true);
                    this.decorations = decorations;
                }
            }
        },
        { decorations: (v) => v.decorations }
    );
}



export class TagWidget extends WidgetType {
    constructor(
        private spanTag: HTMLElement
    ) { super(); }

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
    constructor(
        private anchor: HTMLElement
    ) { super(); }

    toDOM(view: EditorView): HTMLElement {
        const span = createSpan()
        span.innerHTML = `${this.anchor.outerHTML}`;
        return span;
    }
}