import type { AppCard, Connector, Item, Text } from "@mirohq/websdk-types";

import { CardData } from "@/EventTypes";
import { notEmpty } from "@/extension/utils/not-empty";
import { debugLog } from "@/utils/debug-log";
import { extractCardData } from "@/utils/extract-card-data";
import type {
  BoardItemUpdatePayload,
  CreateAppCardInput,
  CreateConnectorInput,
  CreateTextInput,
  DropPayload,
  MiroAdapter,
  SelectionUpdatePayload,
} from "@/utils/miro/adapter";

type EmptyPayload = Record<string, never>;
type AppCardEventPayload = { appCard: Item };

export type FakeItem = FakeAppCard | FakeText;
type SyncEvent = {
  type: "sync";
  boardItems: Map<string, FakeItem>;
  selection: FakeItem[];
};

const log = debugLog("miro-adapter:fake");

export class FakeMiroAdapter implements MiroAdapter {
  private adapterChannel = new BroadcastChannel("miroAdapter");
  private boardId: string;
  constructor(boardId = "board-test") {
    this.boardId = boardId;
    this.onDrop(this.syncSend);
    this.onItemsDelete(this.syncSend);
    this.onItemsUpdate(this.syncSend);
    this.adapterChannel.addEventListener("message", async (m) => {
      const data = m.data as SyncEvent;
      log("sync", data);
      if (data.type === "sync") {
        const convertItem = (data: FakeItem) => {
          const value =
            data.type === "app_card"
              ? new FakeAppCard(this, data)
              : new FakeText(this, data);
          return value as unknown as Item;
        };

        const newLocal = data.boardItems
          .entries()
          .map(([key, value]) => [key, convertItem(value)] as const);

        this.boardItems = new Map(newLocal);
        this.selection = data.selection.map(convertItem);
        this.disableSync = true;
        try {
          for (const listener of this.selectionListeners) {
            await listener({ items: this.selection });
          }
          this.emitItemsUpdate([]);
          this.emitSelectionUpdate(this.selection);
        } finally {
          this.disableSync = false;
        }
      }
    });
  }

  disableSync = false;
  syncSend = () => {
    if (this.disableSync) return;
    log("send sync", this.boardItems);
    const boardItems = Array.from(this.boardItems.entries()).map(([k, i]) => [
      k,
      (i as unknown as FakeItem).toData(),
    ]);
    log("send boardItems", boardItems);
    const selection = Array.from(this.selection).map((i) =>
      (i as unknown as FakeItem).toData(),
    );

    log("sync selection", selection);
    this.adapterChannel.postMessage({
      type: "sync",
      boardItems,
      selection,
    });
  };

  private boardItems = new Map<string, Item>();
  private selection: Item[] = [];
  private zoomedItems: Item[] = [];
  private infoMessages: string[] = [];
  private errorMessages: string[] = [];
  openModalCalls: Array<{
    url: string;
    data?: unknown;
    width?: number;
    height?: number;
  }> = [];
  private openPanelCalls: Array<{ url: string; data?: unknown }> = [];

  private selectionListeners = new Set<
    (event: SelectionUpdatePayload) => void | Promise<void>
  >();
  private dropListeners = new Set<
    (event: DropPayload) => void | Promise<void>
  >();
  private iconClickListeners = new Set<
    (event: EmptyPayload) => void | Promise<void>
  >();
  private appCardOpenListeners = new Set<
    (event: AppCardEventPayload) => void | Promise<void>
  >();
  private appCardConnectListeners = new Set<
    (event: AppCardEventPayload) => void | Promise<void>
  >();
  private itemsUpdateListeners = new Set<
    (event: BoardItemUpdatePayload) => void | Promise<void>
  >();
  private itemsDeleteListeners = new Set<
    (event: BoardItemUpdatePayload) => void | Promise<void>
  >();
  private modalCloseValue: unknown = { ok: true };
  private collections = new Map<string, Map<string, unknown>>();
  private metadata = new Map<string, Map<string, unknown>>();

  setModalCloseValue(value: unknown) {
    this.modalCloseValue = value;
  }

  async emitSelectionUpdate(items: Item[]) {
    this.selection = items;
    for (const listener of this.selectionListeners) {
      await listener({ items });
    }
  }

  async emitDrop(payload: DropPayload) {
    for (const listener of this.dropListeners) {
      await listener(payload);
    }
  }

  async emitIconClick() {
    for (const listener of this.iconClickListeners) {
      await listener({});
    }
  }

  async emitAppCardOpen(appCard: Item) {
    for (const listener of this.appCardOpenListeners) {
      await listener({ appCard });
    }
  }

  async emitAppCardConnect(appCard: Item) {
    for (const listener of this.appCardConnectListeners) {
      await listener({ appCard });
    }
  }

  async emitItemsUpdate(items: Item[]) {
    for (const listener of this.itemsUpdateListeners) {
      await listener({ items });
    }
  }

  async emitItemsDelete(items: Item[]) {
    for (const listener of this.itemsDeleteListeners) {
      await listener({ items });
    }
  }

  async getBoardId() {
    return this.boardId;
  }

  async getBoardItemById(id: string) {
    const item = this.boardItems.get(id);

    return item;
  }

  async getBoardItems(input?: { type?: string[] }) {
    const items = [...this.boardItems.values()];
    if (!input?.type || input.type.length === 0) {
      return items;
    }

    const allowed = new Set(input.type);
    return items.filter((item) => allowed.has(item.type));
  }

  async getSelection() {
    return this.selection;
  }

  async selectByIds(ids: string[]) {
    this.selection = ids
      .map((id) => this.boardItems.get(id))
      .filter(Boolean) as Item[];
    await this.emitSelectionUpdate(this.selection);
  }

  async deselectByIds(ids: string[]) {
    const idSet = new Set(ids);
    this.selection = this.selection.filter((item) => !idSet.has(item.id));
    await this.emitSelectionUpdate(this.selection);
  }

  async zoomTo(items: Item[]) {
    this.zoomedItems = items;
  }

  async createAppCard(input: CreateAppCardInput): Promise<AppCard> {
    const nextId = Math.random().toString(16).substring(2);
    const card = new FakeAppCard(this, {
      id: nextId,
      type: "app_card",
      status: input.status,
      title: input.title,
      description: "",
      x: input.x,
      y: input.y,
      width: 320,
      height: 180,
      fields: [],
    }) as unknown as AppCard;

    this.boardItems.set(card.id, card);

    return card;
  }

  async createConnector(input: CreateConnectorInput) {
    const connector = new FakeConnector(input) as unknown as Connector;
    this.boardItems.set(connector.id, connector);
    this.emitItemsUpdate([connector]);
    return connector;
  }

  async findConnections() {
    return Array.from(
      this.boardItems
        .values()
        .filter((item): item is Connector => item.type === "connector"),
    );
  }

  async createText(input: CreateTextInput): Promise<Text> {
    const nextId = `text-${this.boardItems.size + 1}`;
    const text = new FakeText(this, {
      id: nextId,
      type: "text",
      content: input.content,
      width: input.width,
      height: 20,
      x: input.x,
      y: input.y,
    }) as unknown as Text;
    this.boardItems.set(text.id, text);
    return text;
  }

  async removeItem(item: Item) {
    this.boardItems.delete(item.id);
    this.metadata.delete(item.id);
    this.selection = this.selection.filter(
      (selected) => selected.id !== item.id,
    );
    await this.emitItemsDelete([item]);
    await this.emitSelectionUpdate(this.selection);
  }

  showInfo(message: string) {
    this.infoMessages.push(message);
  }

  showError(message: string) {
    this.errorMessages.push(message);
  }

  getCollection(name: string) {
    const collection = this.collections.get(name) ?? new Map<string, unknown>();
    this.collections.set(name, collection);

    return {
      get: async <T = unknown>(key: string) =>
        (collection.get(key) as T | undefined) ?? undefined,
      set: async (key: string, value: unknown) => {
        collection.set(key, value);
      },
    };
  }

  async onSelectionUpdate(
    listener: (event: SelectionUpdatePayload) => void | Promise<void>,
  ) {
    this.selectionListeners.add(listener);
  }

  async offSelectionUpdate(
    listener: (event: SelectionUpdatePayload) => void | Promise<void>,
  ) {
    this.selectionListeners.delete(listener);
  }

  async onDrop(listener: (event: DropPayload) => void | Promise<void>) {
    this.dropListeners.add(listener);
  }

  async offDrop(listener: (event: DropPayload) => void | Promise<void>) {
    this.dropListeners.delete(listener);
  }

  async onIconClick(listener: (event: EmptyPayload) => void | Promise<void>) {
    this.iconClickListeners.add(listener);
  }

  async offIconClick(listener: (event: EmptyPayload) => void | Promise<void>) {
    this.iconClickListeners.delete(listener);
  }

  async onAppCardOpen(
    listener: (event: AppCardEventPayload) => void | Promise<void>,
  ) {
    this.appCardOpenListeners.add(listener);
  }

  async offAppCardOpen(
    listener: (event: AppCardEventPayload) => void | Promise<void>,
  ) {
    this.appCardOpenListeners.delete(listener);
  }

  async onAppCardConnect(
    listener: (event: AppCardEventPayload) => void | Promise<void>,
  ) {
    this.appCardConnectListeners.add(listener);
  }

  async offAppCardConnect(
    listener: (event: AppCardEventPayload) => void | Promise<void>,
  ) {
    this.appCardConnectListeners.delete(listener);
  }

  async onItemsUpdate(
    listener: (event: BoardItemUpdatePayload) => void | Promise<void>,
  ) {
    this.itemsUpdateListeners.add(listener);
  }

  async offItemsUpdate(
    listener: (event: BoardItemUpdatePayload) => void | Promise<void>,
  ) {
    this.itemsUpdateListeners.delete(listener);
  }

  async onItemsDelete(
    listener: (event: BoardItemUpdatePayload) => void | Promise<void>,
  ) {
    this.itemsDeleteListeners.add(listener);
  }

  async offItemsDelete(
    listener: (event: BoardItemUpdatePayload) => void | Promise<void>,
  ) {
    this.itemsDeleteListeners.delete(listener);
  }

  async openModal(input: {
    url: string;
    data?: unknown;
    width?: number;
    height?: number;
  }) {
    this.openModalCalls.push(input);
    return {
      waitForClose: async () => this.modalCloseValue,
    };
  }

  async closeModal() {
    return;
  }

  async openPanel(input: { url: string; data?: unknown }) {
    this.openPanelCalls.push(input);
  }

  async closePanel() {
    return;
  }
  async getPanelData() {
    return undefined;
  }
  async getModalData() {
    return undefined;
  }

  async getViewportCenter(): Promise<{ x: number; y: number }> {
    return { x: 0, y: 0 };
  }

  async getCards(
    _after: number,
    _center: { x: number; y: number },
  ): Promise<CardData[]> {
    const cards = await Promise.all(
      this.boardItems.values().map(extractCardData),
    );

    return cards.filter(notEmpty);
  }
}

interface FakeCardData {
  id: string;
  type: "app_card";
  status: string;
  title: string;
  description: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fields?: [];
  metadata?: Map<string, unknown>;
}

export class FakeAppCard implements FakeCardData {
  id: string;
  type: "app_card";
  status: string;
  title: string;
  description: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fields?: [];
  metadata?: Map<string, unknown>;
  private miroAdapter: FakeMiroAdapter;
  constructor(miroAdapter: FakeMiroAdapter, data: FakeCardData) {
    this.miroAdapter = miroAdapter;
    this.id = data.id;
    this.type = data.type;
    this.status = data.status;
    this.title = data.title;
    this.description = data.description;
    this.x = data.x;
    this.y = data.y;
    this.width = data.width;
    this.height = data.height;
    this.fields = data.fields ?? [];
    this.metadata = data.metadata ?? new Map();
  }
  toData(): FakeCardData {
    return {
      id: this.id,
      type: this.type,
      status: this.status,
      title: this.title,
      description: this.description,
      x: this.x,
      y: this.y,
      width: this.width,
      height: this.height,
      fields: this.fields ?? [],
      metadata: this.metadata ?? new Map(),
    };
  }
  public owned = true;
  public linkedTo: null | string = null;
  public parentId: null = null;
  async setMetadata(key: string, value: unknown) {
    this.metadata ??= new Map();
    this.metadata.set(key, value);
  }
  async getMetadata(key: string) {
    this.metadata ??= new Map();
    return this.metadata.get(key);
  }

  toJson() {
    return this.toData();
  }
  sync() {
    return this.miroAdapter.emitItemsUpdate([this as unknown as Item]);
  }
}

interface FakeTextData {
  id: string;
  type: "text";
  content: string;
  width: number;
  height: number;
  x: number;
  y: number;
}

export class FakeText implements FakeTextData {
  id: string;
  type: "text";
  content: string;
  width: number;
  height: number;
  x: number;
  y: number;
  private miroAdapter: FakeMiroAdapter;
  constructor(miroAdapter: FakeMiroAdapter, data: FakeTextData) {
    this.miroAdapter = miroAdapter;
    this.id = data.id;
    this.type = data.type;
    this.content = data.content;
    this.width = data.width;
    this.height = data.height;
    this.x = data.x;
    this.y = data.y;
  }
  toData(): FakeTextData {
    return {
      id: this.id,
      type: this.type,
      content: this.content,
      width: this.width,
      height: this.height,
      x: this.x,
      y: this.y,
    };
  }

  toJson() {
    return this.toData();
  }
  sync() {
    return this.miroAdapter.emitItemsUpdate([this as unknown as Item]);
  }
}

class FakeConnector {
  id = Math.random().toString(16).substring(2);
  type = "connector";
  end: CreateConnectorInput["end"];
  start: CreateConnectorInput["start"];
  shape: CreateConnectorInput["shape"];
  style: CreateConnectorInput["style"];
  constructor(input: CreateConnectorInput) {
    this.end = input.end;
    this.start = input.start;
    this.shape = input.shape;
    this.style = input.style;
  }
  toData() {
    return {
      start: this.start,
      end: this.end,
    };
  }
  toJson() {
    return this.toData();
  }
}
