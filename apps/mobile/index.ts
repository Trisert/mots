import { registerRootComponent } from 'expo';
import { ObserveRoot } from 'expo-observe';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
// ObserveRoot.wrap measures Time to First Render for EAS Observe.
registerRootComponent(ObserveRoot.wrap(App));
