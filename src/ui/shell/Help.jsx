// Help popover: the static how-to tips that used to sit in the Overview right column. Reads a list, no game logic.
import * as Popover from '@radix-ui/react-popover';

export function Help({ items = [], title = 'Tips' }) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild><button type="button" className="wl-help" aria-label={title} title={title} data-help>?</button></Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="wl-why" sideOffset={6} collisionPadding={8} align="end" data-help-content>
          <h5>{title}</h5>
          {items.map(([icon, text]) => <div key={text} className="wl-help-row"><span aria-hidden="true">{icon}</span><span>{text}</span></div>)}
          <Popover.Arrow className="wl-why-arrow" width={12} height={6} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
