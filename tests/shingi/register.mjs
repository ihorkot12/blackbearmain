// Підключає хук, що дозволяє тестам імпортувати `./x.js`, коли на диску лежить `./x.ts`
// (так написано імпорти в api/). TypeScript виконує сам Node (type stripping), без tsx.
import { register } from 'node:module';

register('./ts-resolve.mjs', import.meta.url);
