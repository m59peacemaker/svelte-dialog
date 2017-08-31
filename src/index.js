import Dialog from './Dialog.html'
import Alert from './Alert.html'
import Confirm from './Confirm.html'
import unComponent from './lib/un-component'

export default Dialog

const alert = unComponent(Alert)
const confirm = unComponent(Confirm)

export {
  Alert,
  alert,

  Confirm,
  confirm
}
