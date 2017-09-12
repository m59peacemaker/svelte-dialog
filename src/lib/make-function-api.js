const makeFunctionAPI = (DialogComponent) => {
  function dialog (options) {
    const dialogComponent = new DialogComponent({ data: options, target: document.body })
    dialogComponent.on('hidden', () => dialogComponent.destroy())
    return Object.assign(
      new Promise(resolve => dialogComponent.on('result', resolve)),
      { dialog: dialogComponent }
    )
  }
  return Object.assign(dialog, DialogComponent)
}

export default makeFunctionAPI
