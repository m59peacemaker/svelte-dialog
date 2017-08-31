const unComponent = (DialogComponent) => {
  function dialog (options) {
    const dialogComponent = new DialogComponent({ data: options, target: document.body })
    dialogComponent.on('hidden', () => dialogComponent.destroy())
    return dialogComponent
  }
  return dialog
}

export default unComponent
