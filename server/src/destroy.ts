/**
 * Plugin destroy phase: removes the lifecycle subscription created in bootstrap.
 */
import { detachLifecycles } from './bootstrap';

const destroy = () => {
  detachLifecycles();
};

export default destroy;
