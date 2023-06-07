import type { CardProps, DropEvent, TagColor } from '@mirohq/websdk-types';
import React, { useId } from 'react'
import type { Meta } from './miro-shape';
import { useLatestRef } from "./useLatestRef";
import { applyMetaData } from './miro-shape';
import { useTag } from './useTag';
import { useMiroDrop } from '~/plugin-utils/use-miro-drop';

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
  editTitle?: JSX.Element,
  editDescription?: JSX.Element,
}>

export const MiroCard = <M extends Meta>({
  children,
  width = 300,
  onDrop,
  height = 150,
  style = {},
  title,
  editTitle,
  editDescription,
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

  useMiroDrop(handleDrop);

  return (
    <div className="app-card miro-draggable">
      <h1 className="app-card--title">
        {editTitle ?? title}
      </h1>
      <h1 className="app-card--description p-medium">
        {editDescription ?? description}
      </h1>
      <span style={{ display: 'none' }} ref={self}>{description}</span>
      <div className="app-card--body">
        <div className="app-card--tags">
          <Tag>
            {meta?.projectName}
          </Tag>
          {fields?.map((field, i) => (
            <Tag key={i}>
              {field.value}
            </Tag>
          ))}

        </div>
      </div>
    </div>
  )
}

type TagProps = React.PropsWithChildren<{
  background?: TagColor,
}>

function Tag({ children, background }: TagProps) {
  return <span className="tag" style={{
    // @ts-ignore TS doesn't seem to know about setting css variables
    '--background': background,
  }}>
    {children}
  </span>;
}

