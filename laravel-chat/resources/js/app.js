import './echo';
import { startChat } from './chat';

if (window.chat) {
    startChat(window.chat);
}
