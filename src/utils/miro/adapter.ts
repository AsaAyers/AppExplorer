import type { AppCard, Connector, Item, Text } from "@mirohq/websdk-types";
import type { Collection } from "@mirohq/websdk-types/stable/api/storage";

import { CardData } from "@/EventTypes";
import { notEmpty } from "@/extension/utils/not-empty";
import { distance } from "@/utils/distance";
import { extractCardData } from "@/utils/extract-card-data";
import { FakeMiroAdapter } from "@/utils/miro/fake-adapter";

export type SelectionUpdatePayload = { items: Item[] };
export type DropPayload = { x: number; y: number; target: HTMLElement };

type Listener<T> = (event: T) => void | Promise<void>;

export type MiroCollection = Pick<Collection, "get" | "set">;
export type CreateAppCardInput = Pick<AppCard, "x" | "y" | "title" | "status">;
export type CreateConnectorInput = {
  start: { item: string };
  end: { item: string };
  shape: "curved";
  style: { startStrokeCap: "none"; endStrokeCap: "arrow" };
};
export type CreateTextInput = Pick<Text, "content" | "width" | "x" | "y">;
export type BoardItemUpdatePayload = { items: Item[] };

type EmptyPayloadListener = Listener<Record<string, never>>;
type AppCardEventPayload = { appCard: Item };

export interface MiroAdapter {
  getCards(
    after: number,
    center: { x: number; y: number },
  ): Promise<CardData[]>;
  getViewportCenter(): Promise<{ x: number; y: number }>;
  getPanelData<T = unknown>(): Promise<T | undefined>;
  getModalData<T = unknown>(): Promise<T | undefined>;
  getBoardId(): Promise<string>;
  getBoardItemById(id: string): Promise<Item | undefined>;
  getBoardItems(input?: { type?: string[] }): Promise<Item[]>;
  getSelection(): Promise<Item[]>;
  selectByIds(ids: string[]): Promise<unknown>;
  deselectByIds(ids: string[]): Promise<unknown>;
  zoomTo(items: Item[]): Promise<unknown>;
  createAppCard(input: CreateAppCardInput): Promise<AppCard>;
  createConnector(input: CreateConnectorInput): Promise<Connector>;
  createText(input: CreateTextInput): Promise<Text>;
  removeItem(item: Item): Promise<void>;

  showInfo(message: string): void;
  showError(message: string): void;
  getCollection(name: string): MiroCollection;

  onSelectionUpdate(listener: Listener<SelectionUpdatePayload>): Promise<void>;
  offSelectionUpdate(listener: Listener<SelectionUpdatePayload>): Promise<void>;

  onDrop(listener: Listener<DropPayload>): Promise<void>;
  offDrop(listener: Listener<DropPayload>): Promise<void>;

  onIconClick(listener: EmptyPayloadListener): Promise<void>;
  offIconClick(listener: EmptyPayloadListener): Promise<void>;
  onAppCardOpen(listener: Listener<AppCardEventPayload>): Promise<void>;
  offAppCardOpen(listener: Listener<AppCardEventPayload>): Promise<void>;
  onAppCardConnect(listener: Listener<AppCardEventPayload>): Promise<void>;
  offAppCardConnect(listener: Listener<AppCardEventPayload>): Promise<void>;
  onItemsUpdate(listener: Listener<BoardItemUpdatePayload>): Promise<void>;
  offItemsUpdate(listener: Listener<BoardItemUpdatePayload>): Promise<void>;
  onItemsDelete(listener: Listener<BoardItemUpdatePayload>): Promise<void>;
  offItemsDelete(listener: Listener<BoardItemUpdatePayload>): Promise<void>;

  openModal(
    input: OpenModalInput,
  ): Promise<{ waitForClose: () => Promise<unknown> }>;
  closeModal<T>(result?: T): Promise<void>;
  openPanel(input: { url: string; data?: unknown }): Promise<unknown>;
  closePanel(): Promise<void>;
}

type OpenModalInput = {
  url: string;
  height?: number | undefined;
  width?: number | undefined;
  fullscreen?: boolean | undefined;
  data?: unknown;
};

class LiveMiroAdapter implements MiroAdapter {
  getModalData<T>() {
    return miro.board.ui.getModalData<T>();
  }
  getPanelData<T>() {
    return miro.board.ui.getPanelData<T>();
  }
  async getBoardId() {
    return (await miro.board.getInfo()).id;
  }

  async getBoardItemById(id: string) {
    return await miro.board.getById(id);
  }

  async getBoardItems(input?: { type?: string[] }) {
    return await miro.board.get({
      type: input?.type,
    });
  }

  async getSelection() {
    return (await miro.board.getSelection()) as Item[];
  }

  selectByIds(ids: string[]) {
    return miro.board.select({ id: ids });
  }

  deselectByIds(ids: string[]) {
    return miro.board.deselect({ id: ids });
  }

  zoomTo(items: Item[]) {
    return miro.board.viewport.zoomTo(items);
  }

  createAppCard(input: CreateAppCardInput) {
    return miro.board.createAppCard(input);
  }

  async findConnections() {
    return miro.board.get({ type: "connector" });
  }
  async createConnector(input: CreateConnectorInput) {
    return miro.board.createConnector(input);
  }

  createText(input: CreateTextInput) {
    return miro.board.createText(input);
  }

  async removeItem(item: Item) {
    await miro.board.remove(item);
  }

  showInfo(message: string) {
    void miro.board.notifications.showInfo(message);
  }

  showError(message: string) {
    void miro.board.notifications.showError(message);
  }

  getCollection(name: string): MiroCollection {
    const collection = miro.board.storage.collection(name);
    return {
      get: <T = unknown>(key: string) =>
        collection.get(key) as Promise<T | undefined>,
      set: (key: string, value: string) => collection.set(key, value),
    };
  }

  onSelectionUpdate(listener: Listener<SelectionUpdatePayload>) {
    return miro.board.ui.on("selection:update", listener);
  }

  offSelectionUpdate(listener: Listener<SelectionUpdatePayload>) {
    return miro.board.ui.off("selection:update", listener);
  }

  onDrop(listener: Listener<DropPayload>) {
    return miro.board.ui.on("drop", listener);
  }

  offDrop(listener: Listener<DropPayload>) {
    return miro.board.ui.off("drop", listener);
  }

  onIconClick(listener: EmptyPayloadListener) {
    return miro.board.ui.on("icon:click", listener);
  }

  offIconClick(listener: EmptyPayloadListener) {
    return miro.board.ui.off("icon:click", listener);
  }

  onAppCardOpen(listener: Listener<AppCardEventPayload>) {
    return miro.board.ui.on("app_card:open", listener);
  }

  offAppCardOpen(listener: Listener<AppCardEventPayload>) {
    return miro.board.ui.off("app_card:open", listener);
  }

  onAppCardConnect(listener: Listener<AppCardEventPayload>) {
    return miro.board.ui.on("app_card:connect", listener);
  }

  offAppCardConnect(listener: Listener<AppCardEventPayload>) {
    return miro.board.ui.off("app_card:connect", listener);
  }

  onItemsUpdate(listener: Listener<BoardItemUpdatePayload>) {
    return miro.board.ui.on("experimental:items:update", listener);
  }

  offItemsUpdate(listener: Listener<BoardItemUpdatePayload>) {
    return miro.board.ui.off("experimental:items:update", listener);
  }

  onItemsDelete(listener: Listener<BoardItemUpdatePayload>) {
    return miro.board.ui.on("items:delete", listener);
  }

  offItemsDelete(listener: Listener<BoardItemUpdatePayload>) {
    return miro.board.ui.off("items:delete", listener);
  }

  openModal(input: OpenModalInput) {
    return miro.board.ui.openModal({
      data: undefined,
      ...input,
    });
  }

  closeModal<T>(result?: T) {
    return miro.board.ui.closeModal(result);
  }

  openPanel(input: { url: string; data?: unknown }) {
    return miro.board.ui.openPanel({ data: undefined, ...input });
  }

  closePanel() {
    return miro.board.ui.closePanel();
  }

  async getViewportCenter() {
    const viewport = await miro.board.viewport.get();
    const x = viewport.x + viewport.width / 2;
    const y = viewport.y + viewport.height / 2;
    return { x, y };
  }

  async getCards(after: number, center: { x: number; y: number }) {
    let cards = await miro?.board.get({
      type: "app_card",
    });
    cards.sort((a, b) => {
      const distA = distance(center, a);
      const distB = distance(center, b);
      return distA - distB;
    });

    cards = cards.slice(after);
    cards.length = Math.min(cards.length, 20);
    const cardData = (await Promise.all(cards.map(extractCardData))).filter(
      notEmpty,
    );
    return cardData;
  }
}

let singleton: MiroAdapter | undefined;
let fakeSingleton: MiroAdapter | undefined;

export type GetMiroAdapterOptions = {
  forceFake?: boolean;
};

function createMiroAdapter(options: GetMiroAdapterOptions = {}): MiroAdapter {
  if (options.forceFake) {
    return new FakeMiroAdapter();
  }

  return typeof miro !== "undefined"
    ? new LiveMiroAdapter()
    : new FakeMiroAdapter();
}

export function resetMiroAdapter() {
  singleton = undefined;
  fakeSingleton = undefined;
}

export function getMiroAdapter(
  options: GetMiroAdapterOptions = {},
): MiroAdapter {
  if (options.forceFake) {
    fakeSingleton ??= createMiroAdapter({ forceFake: true });
    return fakeSingleton;
  }

  singleton ??= createMiroAdapter();
  return singleton;
}
