// Every entry here becomes a toggle switch in the settings dialog.
const SETTINGS = [
  {
    id: "allowCollisions",
    label: "Allow collisions",
    description:
      "Let courses overlap on the same timeslot. Colliding courses are shown together in the cell.",
    defaultValue: false,
  },
];

const DEFAULT_SETTINGS = SETTINGS.reduce(
  (defaults, { id, defaultValue }) => ({ ...defaults, [id]: defaultValue }),
  {}
);

export { SETTINGS, DEFAULT_SETTINGS };
