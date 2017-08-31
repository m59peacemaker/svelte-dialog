# svelte-dialog

Vanilla JS dialog services and components made with Svelte.

[View the demo.](https://m59peacemaker.github.io/svelte-dialog/)

## install

```sh
$ npm install svelte-dialog
```

## example

```js
import { Confirm, Alert, Prompt } from 'svelte-dialog'

const dialog = Confirm({ some, options }) // I will make less jankety docs later, sorry friend

dialog.on('closed', result => {
  result // result that was passed to `dialog.close`
})

dialog.on('dismissed', result => {
  result // result that was passed to `dialog.dismissed`
})

dialog.open()

dialog.close('foo')
// or
dialog.dismiss('bar')
```
