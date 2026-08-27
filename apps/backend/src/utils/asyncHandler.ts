import type { NextFunction, Request, RequestHandler, Response } from 'express';

/** Express 4 doesn't catch rejected promises from async route handlers on its own. */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
