import type { WidgetMixin, AppDataValue, DropEvent, Shape, ShapeProps } from '@mirohq/websdk-types';
import classNames from 'classnames';
import React, { useId } from 'react'
import { useLatestRef } from './useLatestRef';

const defaultStyles = {
  fillColor: "#F7F5F2",
  textAlign: 'center',
  textAlignVertical: 'middle',
  borderColor: '#000000',
  borderStyle: 'normal',
  borderOpacity: 1,
  color: "#007891",
  borderWidth: 1,
  fontSize: 28,
}


export type Meta = {
  projectName?: string,
  path?: string
}


type Props = React.PropsWithChildren<{
  shape?: ShapeProps['shape']
  onDrop?: (shape: Shape) => void,
  width: number,
  height: number,
  style?: ShapeProps['style']
  meta?: Record<string, AppDataValue>
}>
export const MiroShape = ({
  shape = 'round_rectangle',
  children,
  width,
  onDrop,
  height,
  style = {},
  meta,
}: Props) => {
  const id = useId()
  const self = React.useRef<HTMLDivElement>(null)

  const shapeStyle = React.useMemo(() => {
    return Object.assign({}, defaultStyles, style)
  }, [style])

  const handleDrop = React.useCallback(async ({ x, y, target }: DropEvent) => {
    if (!target.contains(self.current!)) {
      return
    }

    const zoom = await miro.board.viewport.getZoom()
    const shapeItem = await miro.board.createShape({
      x,
      y,
      width: width / zoom,
      height: height / zoom,
      shape,
      content: self.current?.innerHTML ?? '(empty)',
      style: {
        ...shapeStyle,
        fontSize: Math.round(shapeStyle.fontSize / zoom),
      },
    });
    await applyMetaData<M>(meta, shapeItem);
    await shapeItem.sync();
    onDrop?.(shapeItem)
  }, [height, meta, onDrop, shape, shapeStyle, width])

  const handlerRef = useLatestRef(handleDrop)

  React.useEffect(() => {
    const stableHandler: typeof handlerRef.current = (...args) => handlerRef.current(...args);

    miro.board.ui.on("drop", stableHandler);
    return () => {
      // Miro doesn't like it when strict mode causes a handler to be registerd
      // and immediately unregistered. Adding a delay seems to fix it.
      new Promise(r => setTimeout(r, 1)).then(() => {
        miro.board.ui.off("drop", stableHandler);
      })
    }
  }, [handlerRef, id]);

  return (
    <div
      className={classNames(
        'max-w-xs',
        'miro-draggable draggable-item relative p-2', {
        'rounded-lg': shape === 'round_rectangle',
        'rounded-[100%]': shape === 'circle',

        'text-center': shapeStyle.textAlign === 'center',
        'text-left': shapeStyle.textAlign === 'left',
        'text-right': shapeStyle.textAlign === 'right',

        'flex flex-col justify-around': shapeStyle.textAlignVertical === 'middle',
        'flex flex-col justify-start': shapeStyle.textAlignVertical === 'top',
        'flex flex-col justify-end': shapeStyle.textAlignVertical === 'bottom',

        'border-solid': shapeStyle.borderStyle === 'normal',
        'border-0': shapeStyle.borderWidth === 0,
        'border-2': shapeStyle.borderWidth === 1,
        'border-4': shapeStyle.borderWidth === 2,
        'border-8': shapeStyle.borderWidth === 3,
      }
      )}
      style={{
        backgroundColor: shapeStyle.fillColor,
        aspectRatio: `${width}/${height}`,
        color: shapeStyle.color,
        borderColor: shapeStyle.borderColor,
        fontSize: shapeStyle.fontSize,
      }}
      data-id={id}>
      <span ref={self}>
        {children}
      </span>
    </div>
  )

}

export async function applyMetaData<M extends Meta>(meta: M | undefined, shapeItem: WidgetMixin) {
  await Promise.all(Object.entries(meta || {}).map(async ([key, value]) => {
    if (value != null) {
      return shapeItem.setMetadata(key, value as any);
    }
  }));
}
