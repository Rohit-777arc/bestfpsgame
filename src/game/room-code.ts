const ROOM_LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";

export function makeRoomCode(): string {
  const characters = Array.from({ length: 4 }, () =>
    ROOM_LETTERS[Math.floor(Math.random() * ROOM_LETTERS.length)],
  );
  characters.push(
    String(Math.floor(Math.random() * 10)),
    String(Math.floor(Math.random() * 10)),
  );

  for (let index = characters.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [characters[index], characters[swapIndex]] = [characters[swapIndex], characters[index]];
  }

  return characters.join("");
}

export function isRoomCode(value: string): boolean {
  return /^[A-Z0-9]{6}$/i.test(value) && (value.match(/[0-9]/g)?.length ?? 0) === 2;
}