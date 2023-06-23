import type {
  AppCard,
  AppCardProps,
  AppData,
  AppDataValue,
  BoardNode,
  CardProps,
  Item,
  Shape,
  ShapeProps,
} from "@mirohq/websdk-types";
import { useFetcher } from "@remix-run/react";
import identity from "lodash.identity";
import React from "react";
import invariant from "tiny-invariant";
import { useMiroDrop } from "~/plugin-utils/use-miro-drop";
import { useMiroJiggle } from "./use-miro-jiggle";
import { assertNever } from "./assertNever";
import classNames from "classnames";
import { useIsMiroConnected, useMiroQuery } from "./miro-context";

export type ConnectedResponse<T extends ImplementedTypes> = {
  type: T;
  props: PropMap[T];
};
type PropMap = {
  card: CardProps;
  app_card: AppCardProps;
  shape: ShapeProps;
};
type PropsForType<T extends ImplementedTypes> = T extends "card"
  ? CardProps
  : T extends "app_card"
  ? AppCardProps
  : T extends "shape"
  ? ShapeProps
  : {};

type ImplementedTypes = "card" | "app_card" | "shape";

async function findNodeWithMeta(
  type: ImplementedTypes,
  id: string,
  keyValue: string
) {
  const existingItems = await miro.board.get({ type });
  return existingItems.reduce(async (m, node) => {
    const match = await m;
    if (match && match.type === type) return match;

    if (node.type === type) {
      if ((await node.getMetadata(id)) === keyValue) {
        return node;
      }
    }
  }, Promise.resolve(undefined as undefined | Extract<BoardNode, { type: ImplementedTypes }>));
}

async function createOrUpdate<Type extends ImplementedTypes>(
  type: Type,
  dataSource: string,
  props: PropsForType<Type>,
  node?: Extract<BoardNode, { type: Type }>
): Promise<Extract<BoardNode, { type: Type }>> {
  switch (node?.type) {
    case "app_card":
    case "card":
    case "shape": {
      const actual = await (node as AppCard).getMetadata("dataSource");
      invariant(
        actual === dataSource,
        () => `dataSource mismatch. Found: ${actual} Expected: ${dataSource}`
      );
      Object.assign(node, props);
      await node.sync();
      return node;
    }
    default: {
      const withMeta = async (item: Promise<BoardNode>) => {
        ((await item) as Shape).setMetadata("dataSource", dataSource);
        return item;
      };
      console.log("create", type, props);

      // When calling this function, TS knows to associate "AppCard" with
      // "AppCardProps", but it's not convinced they match here.
      switch (type) {
        case "app_card":
          // @ts-expect-error
          return withMeta(miro.board.createAppCard(props as AppCardProps));
        case "card":
          // @ts-expect-error
          return withMeta(miro.board.createCard(props as CardProps));
        case "shape":
          // @ts-expect-error
          return withMeta(miro.board.createShape(props as ShapeProps));
        default:
          assertNever(type);
      }
    }
  }
}
type Props<
  Type extends keyof PropMap,
  MetaKeys extends string = "apiEndpoint"
> = {
  type: Type;
  meta: Record<MetaKeys, AppDataValue> & Record<string, AppDataValue>;
  id: MetaKeys;
  Component: React.ComponentType<
    PropsForType<Type> & {
      node?: Extract<BoardNode, { type: Type }>;
    }
  >;
};

export function ConnectedBoardItem<T extends ImplementedTypes & string>({
  meta,
  id,
  Component,
  type,
}: Props<T>) {
  const apiEndpoint = meta.apiEndpoint;
  invariant(typeof apiEndpoint === "string", "apiEndpoint must be a string");

  const keyValue = meta[id];
  const isConnected = useIsMiroConnected()
  const nodeQueryState = useMiroQuery(async () => {
    if (typeof keyValue === "string") {
      console.log('findNodeWithMeta', type, id, keyValue)
      return findNodeWithMeta(type, id, keyValue)
    }
  }, [keyValue, id, type]);
  const nodeOnBoard = nodeQueryState.value

  type Result = {
    type: T;
    props: PropsForType<T>;
  };
  const fetcher = useFetcher<Result>();
  React.useEffect(() => {
    if (fetcher.state === "idle" && !fetcher.data) {
      fetcher.load(apiEndpoint);
    }
  }, [apiEndpoint, fetcher.data, fetcher]);
  // @ts-expect-error https://github.com/remix-run/remix/issues/6632
  if (fetcher.data && fetcher.data?.type !== type) {
    throw new Error(
      // @ts-expect-error https://github.com/remix-run/remix/issues/6632
      "type mismatch. expected " + type + " got " + fetcher.data?.type
    );
  }

  const boardItemProps: PropsForType<T> =
    // @ts-expect-error https://github.com/remix-run/remix/issues/6632
    fetcher.data?.props ?? loadingProps(type);

  const self = React.useRef<HTMLDivElement>(null);
  useMiroDrop(async ({ x, y, target }) => {
    if (!target.contains(self.current!)) {
      return;
    }

    let position: { x?: number; y?: number } = { x, y };
    if (nodeOnBoard?.parentId) {
      delete position.x;
      delete position.y;
    } else if (nodeOnBoard) {
      position.x = nodeOnBoard.x;
      position.y = nodeOnBoard.y;
    }

    const item = await createOrUpdate(
      type,
      apiEndpoint,
      {
        ...boardItemProps,
        ...position,
      },
      // @ts-ignore
      nodeOnBoard
    );
    await Object.entries(meta).reduce(async (i, [key, value]) => {
      (await i).setMetadata(key, value);
      return i;
    }, Promise.resolve(item as Item));
  });

  const viewOnBoard = async (node: Item): Promise<void> => {
    if ("parentId" in node && node.parentId) {
      const parent = await miro.board.getById(node.parentId);
      if (parent && parent.type !== "tag") {
        return viewOnBoard(parent);
      }
    }
    miro.board.viewport.zoomTo([node]);
  };

  const diff = React.useMemo(() => {
    if (boardItemProps && nodeOnBoard) {
      const keys = Object.keys(boardItemProps);
      return keys.filter((k) => {
        const key = k as keyof PropsForType<any>;
        const currentValue = JSON.stringify(boardItemProps[key]);
        const nodeValue = JSON.stringify(nodeOnBoard[key]);
        return currentValue !== nodeValue;
      });
    }
    return [];
  }, [boardItemProps, nodeOnBoard]);

  return (
    <div ref={self} className="miro-draggable">
      {isConnected && (
        <button
          disabled={!nodeOnBoard}
          className={classNames("button button-small button-primary", {
            "button-loading": nodeQueryState.state === "running"
          })}
          onClick={() => viewOnBoard(nodeOnBoard!)}
        >
          <div>
            View on board
          </div>
        </button>
      )}
      {diff.length > 0 && (
        <div>
          Updates Available (Drag the card onto the board to apply):
          <ul>
            {diff.map((key) => (
              <li
                key={key}
                style={{ display: "flex", flexDirection: "column" }}
              >
                {key}
              </li>
            ))}
          </ul>
        </div>
      )}
      {/* @ts-expect-error */}
      <Component {...boardItemProps} />
    </div>
  );
}

function loadingProps<Type extends ImplementedTypes>(
  type: Type
): PropsForType<Type> {
  switch (type) {
    case "app_card": {
      // @ts-expect-error
      return identity<AppCardProps>({
        type,
        title: "loading...",
      });
    }
    case "card": {
      // @ts-expect-error
      return identity<CardProps>({
        type,
        title: "loading...",
      });
    }
    case "shape": {
      // @ts-expect-error
      return identity<ShapeProps>({
        type,
        content: "loading...",
      });
    }
    default:
      assertNever(type);
  }
}
