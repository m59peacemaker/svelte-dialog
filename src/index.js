import Dialog from './Dialog.html'
import Alert from './Alert.html'
import Confirm from './Confirm.html'
import makeFunctionAPI from './lib/make-function-api'

export default Dialog

const alert = makeFunctionAPI(Alert)
const confirm = makeFunctionAPI(Confirm)

export {
  Alert,
  alert,

  Confirm,
  confirm
}
