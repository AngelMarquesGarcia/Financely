let counter = 0;

export function addOne() {
  console.log('Button clicked in Electron main process');
  console.log('Not much more to say');
  counter++;
  return counter;
}
