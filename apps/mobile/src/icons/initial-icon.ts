/** Profile circle for the iOS tab bar. 30pt, a step larger than the 26pt line icons. */

const icons = {
  A: require("../../assets/icons/initials/A.png"),
  B: require("../../assets/icons/initials/B.png"),
  C: require("../../assets/icons/initials/C.png"),
  D: require("../../assets/icons/initials/D.png"),
  E: require("../../assets/icons/initials/E.png"),
  F: require("../../assets/icons/initials/F.png"),
  G: require("../../assets/icons/initials/G.png"),
  H: require("../../assets/icons/initials/H.png"),
  I: require("../../assets/icons/initials/I.png"),
  J: require("../../assets/icons/initials/J.png"),
  K: require("../../assets/icons/initials/K.png"),
  L: require("../../assets/icons/initials/L.png"),
  M: require("../../assets/icons/initials/M.png"),
  N: require("../../assets/icons/initials/N.png"),
  O: require("../../assets/icons/initials/O.png"),
  P: require("../../assets/icons/initials/P.png"),
  Q: require("../../assets/icons/initials/Q.png"),
  R: require("../../assets/icons/initials/R.png"),
  S: require("../../assets/icons/initials/S.png"),
  T: require("../../assets/icons/initials/T.png"),
  U: require("../../assets/icons/initials/U.png"),
  V: require("../../assets/icons/initials/V.png"),
  W: require("../../assets/icons/initials/W.png"),
  X: require("../../assets/icons/initials/X.png"),
  Y: require("../../assets/icons/initials/Y.png"),
  Z: require("../../assets/icons/initials/Z.png"),
} as const;

export function initialIcon(letter: string) {
  const key = /^[A-Z]$/.test(letter) ? letter : "P";
  return icons[key as keyof typeof icons];
}

export function profileLetter(name: string) {
  const trimmed = name.trim();
  const word = trimmed || "Profile";
  const letter = word.slice(0, 1).toUpperCase();
  return /^[A-Z]$/.test(letter) ? letter : "P";
}
