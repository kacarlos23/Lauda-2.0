import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { moveListItem, SortableSongList } from "./SortableSongList";

jest.mock("react-native", () => {
  const React = require("react");
  const View = React.forwardRef(({ children, ...props }: any, ref: any) => React.createElement("View", { ...props, ref }, children));
  class ValueXY {
    value: { x: number; y: number };
    constructor(value: { x: number; y: number }) { this.value = value; }
    setValue(value: { x: number; y: number }) { this.value = value; }
    stopAnimation() {}
    getTranslateTransform() { return [{ translateX: this.value.x }, { translateY: this.value.y }]; }
  }
  return {
    View,
    Animated: { View, ValueXY, timing: (value: any, config: any) => ({ start: (complete: any) => { value.setValue(config.toValue); complete?.({ finished: true }); } }) },
    Easing: { out: (value: any) => value, cubic: (value: any) => value },
    Text: ({ children, ...props }: any) => React.createElement("Text", props, children),
    Platform: { OS: "android", select: (values: any) => values.default },
    PanResponder: { create: (handlers: any) => ({ panHandlers: handlers }) },
    StyleSheet: { create: (styles: any) => styles },
  };
});
jest.mock("lucide-react-native", () => ({ GripVertical: () => null }));

describe("ordenação compartilhada das músicas", () => {
  it("move a música preservando seus metadados e a ordem das demais", () => {
    const songs = [{ id: "a", moment: "Comunhão" }, { id: "b", moment: "Ofertório" }, { id: "c", moment: "Louvor" }];
    expect(moveListItem(songs, 0, 2)).toEqual([songs[1], songs[2], songs[0]]);
    expect(moveListItem(songs, 2, 0)).toEqual([songs[2], songs[0], songs[1]]);
    expect(moveListItem(songs, -1, 1)).toBe(songs);
    expect(moveListItem(songs, 0, 3)).toBe(songs);
    expect(songs.map((song) => song.id)).toEqual(["a", "b", "c"]);
  });
  it("confirma o gesto ao soltar e não altera a ordem ao cancelar ou estar desabilitado", () => {
    const onMove = jest.fn();
    const props = { items: ["a", "b", "c"], itemKey: (item: string) => item, itemLabel: (item: string) => item, onMove, renderItem: (item: string) => <React.Fragment>{item}</React.Fragment> };
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(<SortableSongList {...props} />, {
        createNodeMock: (node) => ({
          measureInWindow: (callback: any) => {
            const index = props.items.indexOf(String((node.props as any).testID).replace("sortable-", ""));
            callback(0, index * 100, 300, 100);
          },
        }),
      });
    });
    const handle = () => renderer.root.find((node) => node.type === ("View" as any) && node.props.testID === "drag-a");
    act(() => handle().props.onPanResponderGrant());
    act(() => handle().props.onPanResponderMove({}, { moveY: 250, dx: 12, dy: 200 }));
    act(() => handle().props.onPanResponderRelease());
    expect(onMove).toHaveBeenCalledWith(0, 2);
    onMove.mockClear();
    act(() => handle().props.onPanResponderGrant());
    act(() => handle().props.onPanResponderMove({}, { moveY: 250, dx: 12, dy: 200 }));
    act(() => handle().props.onPanResponderTerminate());
    expect(onMove).not.toHaveBeenCalled();
    act(() => renderer.update(<SortableSongList {...props} disabled />));
    expect(renderer.root.findAll((node) => node.props.testID === "drag-a")).toHaveLength(0);
  });
});
