import groups from "../model/groups.json";

export function getMinifiedUserGroups(userGroups: string[]) {
  return userGroups.map((group) => groups[group as keyof typeof groups]);
}

export function getUserGroupLabel(group: string) {
  return Object.keys(groups).find(
    (key) => groups[key as keyof typeof groups] === group
  );
}

export function getUserGroupsLabels(userGroups: string[]) {
  return userGroups.map((group) => getUserGroupLabel(group));
}
