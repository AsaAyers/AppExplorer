"use client";
import classNames from "classnames";
import React from "react";
import invariant from "tiny-invariant";

const taskList = [
  { key: "added", label: "Add any card to board" },
  { key: "clicked", label: "Select a card to navigate between files" },
  { key: "moved", label: "Move any card on the board" },
  { key: "saveDoc", label: "Add saveDoc card to board" },
  { key: "connected", label: "Attach new cards to selected card" },
] as const;

export type TaskKey = (typeof taskList)[number]["key"];

const context = React.createContext<
  null | [Set<TaskKey>, (key: TaskKey) => void]
>(null);

export const TaskContextProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [events, markEvent] = React.useReducer(
    (prev, key: TaskKey) => {
      const s = new Set(prev);
      s.add(key);
      return s;
    },

    new Set<TaskKey>(),
  );

  return (
    <context.Provider value={[events, markEvent]}>{children}</context.Provider>
  );
};

export function useTasks() {
  const v = React.useContext(context);
  invariant(v, "useTasks must be used within a TaskContextProvider");
  return v;
}

export function TaskList({ events }: { events: Set<TaskKey> }) {
  const tasks = React.useMemo(() => {
    return taskList.map(({ key, label }) => {
      const isCompleted = events.has(key);
      return {
        key,
        isCompleted,
        jsx: (
          <li
            key={key}
            className={classNames(
              "flex items-center gap-2 px-3 py-2 rounded-md transition-all duration-200",
              {
                "text-gray-400": !isCompleted,
                "text-green-700": isCompleted,
              },
            )}
          >
            <span className="text-lg">{isCompleted ? "✓" : "○"}</span>
            <span
              className={classNames({
                "line-through": isCompleted,
                "font-medium": !isCompleted,
              })}
            >
              {label}
            </span>
          </li>
        ),
      };
    });
  }, [events]);

  return <ul className="space-y-1 text-sm">{tasks.map((t) => t.jsx)}</ul>;
}

export const useLastTaskHelper = () => {
  const [events] = useTasks();

  return React.useMemo(() => {
    const todo = taskList.filter((t) => !events.has(t.key));
    if (todo.length !== 1) {
      return;
    }
    return todo[0].key;
  }, [events]);
};
