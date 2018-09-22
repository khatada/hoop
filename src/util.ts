
export function uniqueId(n: number = 8): string {
    const letters = "abcdefghijklmnopqrstuvwxyz";
    let id = "";
    for (let i = 0; i < n; i++) {
        const char = letters[Math.floor(Math.random() * letters.length)];
        id += char;
    }
    return id;
}