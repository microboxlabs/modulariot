/**
 * Mock "people" pool for storytelling. The frontend-only storytelling
 * feature has no real user directory wired in yet, so story creators,
 * last-editors and share-panel invitees all draw from this one list. Keeps
 * the seed data, the share panel and the list-page filters showing the same
 * set of names.
 */

export const AI_AUTHOR = "Harness AI";

export interface StoryPerson {
  readonly id: string;
  readonly name: string;
  readonly email: string;
}

export const STORY_PEOPLE: readonly StoryPerson[] = [
  { id: "u-ana", name: "Ana Fuentes", email: "ana.fuentes@modulariot.com" },
  {
    id: "u-bruno",
    name: "Bruno Salinas",
    email: "bruno.salinas@modulariot.com",
  },
  { id: "u-carla", name: "Carla Méndez", email: "carla.mendez@modulariot.com" },
  { id: "u-diego", name: "Diego Rojas", email: "diego.rojas@modulariot.com" },
  {
    id: "u-elena",
    name: "Elena Paredes",
    email: "elena.paredes@modulariot.com",
  },
  {
    id: "u-felipe",
    name: "Felipe Ortega",
    email: "felipe.ortega@modulariot.com",
  },
  {
    id: "u-gabriela",
    name: "Gabriela Ruiz",
    email: "gabriela.ruiz@modulariot.com",
  },
  { id: "u-hugo", name: "Hugo Navarro", email: "hugo.navarro@modulariot.com" },
];

/** Every name that can appear as a story's creator — the AI author plus the
 * mock directory. Used to build the "Creator" filter's options. */
export const STORY_AUTHOR_NAMES: readonly string[] = [
  AI_AUTHOR,
  ...STORY_PEOPLE.map((person) => person.name),
];
