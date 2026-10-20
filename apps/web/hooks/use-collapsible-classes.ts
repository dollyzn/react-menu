export default function useCollapsibleClasses(level: number) {
  const GROUP_CLASSES: Record<number, string> = {
    0: "group/collapsible1",
    1: "group/collapsible2",
    2: "group/collapsible3",
    3: "group/collapsible4",
    4: "group/collapsible5",
  };

  const CHILD_GROUP_CLASSES: Record<number, string> = {
    0: "group-data-[state=open]/collapsible1:rotate-90",
    1: "group-data-[state=open]/collapsible2:rotate-90",
    2: "group-data-[state=open]/collapsible3:rotate-90",
    3: "group-data-[state=open]/collapsible4:rotate-90",
    4: "group-data-[state=open]/collapsible5:rotate-90",
  };

  return {
    groupClass: GROUP_CLASSES[level] || "group/collapsible",
    childGroupClass:
      CHILD_GROUP_CLASSES[level] ||
      "group-data-[state=open]/collapsible:rotate-90",
  };
}
