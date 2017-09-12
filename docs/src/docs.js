import Demo from './Demo.html'
import { alert, confirm } from '../../src'

window.dialog = { alert, confirm }
window.app = new Demo({ target: document.body })
