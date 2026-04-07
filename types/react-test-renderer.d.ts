declare module "react-test-renderer" {
  export type ReactTestRenderer = {
    root: {
      findAllByProps(props: Record<string, unknown>): Array<{ children: unknown[]; props: Record<string, unknown> }>;
      findByProps(props: Record<string, unknown>): { children: unknown[]; props: Record<string, unknown> };
    };
    unmount(): void;
  };

  export function act(callback: () => void | Promise<void>): Promise<void> | void;

  const TestRenderer: {
    create(element: JSX.Element): ReactTestRenderer;
  };

  export default TestRenderer;
}
