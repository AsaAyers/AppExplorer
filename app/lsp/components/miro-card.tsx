import type { CardProps, DropEvent } from '@mirohq/websdk-types';
import classNames from 'classnames';
import React, { useId } from 'react'
import type { Meta } from './miro-shape';
import { useLatestRef } from "./useLatestRef";
import { applyMetaData } from './miro-shape';
import { useTag } from './useTag';

type Props<M extends Meta> = Pick<CardProps,
  | 'height'
  | 'width'
  | 'x'
  | 'y'
  | 'style'
  | 'fields'
  | 'title'
> & React.PropsWithChildren<{
  onDrop: (card: CardProps) => void,
  meta?: M
}>

export const MiroCard = <M extends Meta>({
  children,
  width = 300,
  onDrop,
  height = 150,
  style = {},
  title,
  children: description,
  meta,
  fields,
}: Props<M>) => {
  const id = useId()
  const self = React.useRef<HTMLDivElement>(null)

  const projectTag = useTag(meta?.projectName)


  const handleDrop = React.useCallback(async ({ x, y, target }: DropEvent) => {
    if (!target.contains(self.current!)) {
      return
    }

    const zoom = await miro.board.viewport.getZoom()
    const description = self.current?.innerHTML ?? '(empty)';

    // I'm not using an appCard, because interacting with them requires
    // AppExplorer to be running.  Currently, it just runs on localhost so you
    // can interact with code on your machine.
    const shapeItem = await miro.board.createCard({
      x,
      y,
      width: width / zoom,
      height: height / zoom,
      title,
      description: description,
      style,
      tagIds: projectTag ? [projectTag] : [],
      fields,
    });
    applyMetaData(meta, shapeItem)
    await shapeItem.sync();
    onDrop?.(shapeItem)
  }, [fields, height, meta, onDrop, projectTag, style, title, width])

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
        'border-2 border-[#0000FF] border-l-8',
        'miro-draggable relative p-2', {
      }
      )}
      style={{
        // backgroundColor: shapeStyle.fillColor,
        aspectRatio: `${width}/${height}`,
        // color: shapeStyle.color,
        // borderColor: shapeStyle.borderColor,
        // fontSize: shapeStyle.fontSize,
      }}
      data-id={id}>
      {title}
      <hr />
      <span ref={self}>{description}</span>
    </div>
  )

}