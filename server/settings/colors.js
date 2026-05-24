const USER_COLORS = [
  "#3b82f6",
  "#a855f7",
  "#f97316",
  "#8b5cf6",
  "#ef4444",
  "#14b8a6",
  "#f59e0b",
  "#ec4899",
  "#84cc16",
  "#60a5fa",
];

function setUserColor() {
  const index = Math.floor(Math.random() * USER_COLORS.length);
  return USER_COLORS[index];
}

export { USER_COLORS, setUserColor };
