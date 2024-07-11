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
import { randomUUID } from "crypto";
import Tools5eTagLinkPlugin from "main";
import {
    editorLivePreviewField
} from "obsidian";
import { TagProcessor } from "./processor";

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

export class TagWidget extends WidgetType {
    readonly id = randomUUID();
    constructor(
        private link: ReturnType<TagProcessor['getLinks']>[number]
    ) { super(); }

    eq(other: TagWidget) {
        if (!(other instanceof TagWidget)) return false;
        return this.id === other.id;
    }

    toDOM(view: EditorView): HTMLElement {
        const span = createSpan()
        span.innerHTML = ` ${this.link.span.outerHTML} `
        return span;
    }
}

function inlineRender(view: EditorView, plugin: Tools5eTagLinkPlugin) {
    const currentFile = this.app.workspace.getActiveFile();
    if (!currentFile) return;

    const posSet = new Set();
    const widgets: Range<Decoration>[] = [];
    const selection = view.state.selection;
    for (const { from, to } of view.visibleRanges) {
        syntaxTree(view.state).iterate({
            from,
            to,
            enter: ({ node }) => {
                const type = node.type;
                if (type.name.includes("formatting")) return;

                const original = view.state.doc.sliceString(node.from, node.to).trim();
                const links = plugin.processor.getLinks(original);

                for (const link of links) {
                    const tagWidget = new TagWidget(link);

                    const start = node.from + link.start;
                    const end = node.from + link.end;

                    const posHash = `${start}:${end}`;
                    if (posSet.has(posHash)) {
                        continue;
                    }
                    posSet.add(posHash);
    
                    const mark = Decoration.mark({ attributes: { style: "font-weight: 700; font-style: italic;" } }).range(start, end);
                    widgets.push(mark);

                    if (selectionAndRangeOverlap(selection, start, end)) {
                        const markActive = Decoration.mark({ attributes: { style: "background-color: yellow;" } }).range(start, end);
                        widgets.push(markActive);
                        continue;
                    }

                    const tag = Decoration.widget({ widget: tagWidget }).range(end);
                    widgets.push(tag);
                }
            }
        });
    }
    return Decoration.set(widgets, true);
}

export function inlinePlugin(plugin: Tools5eTagLinkPlugin) {
    return ViewPlugin.fromClass(
        class {
            decorations: DecorationSet;
            constructor(view: EditorView) {
                this.decorations = Decoration.none;
            }

            update(update: ViewUpdate) {
                // only activate in LP and not source mode
                if (!update.state.field(editorLivePreviewField)) {
                    this.decorations = Decoration.none;
                    return;
                }

                if (
                    update.docChanged ||
                    update.viewportChanged ||
                    update.selectionSet
                ) {
                    this.decorations =
                        inlineRender(update.view, plugin) ?? Decoration.none;
                }
            }
        },
        { decorations: (v) => v.decorations }
    );
}