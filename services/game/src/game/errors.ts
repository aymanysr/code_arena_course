import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from "@nestjs/common";

/** Maps engine error codes to HTTP status; unknown faults become 500 without leaking internals. */
@Catch()
export class EngineErrorFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse();
    if (exception instanceof HttpException) {
      res.status(exception.getStatus()).json({ error: exception.message });
      return;
    }
    const code = (exception as { code?: unknown }).code;
    const message = exception instanceof Error ? exception.message : "internal error";
    const status =
      code === 403
        ? HttpStatus.FORBIDDEN
        : code === 409
          ? HttpStatus.CONFLICT
          : code === 400
            ? HttpStatus.BAD_REQUEST
            : code === 429
              ? HttpStatus.TOO_MANY_REQUESTS
              : code === 404
                ? HttpStatus.NOT_FOUND
                : code === 410
                ? HttpStatus.GONE
                : HttpStatus.INTERNAL_SERVER_ERROR;
    const safe = status === HttpStatus.INTERNAL_SERVER_ERROR ? "internal error" : message;
    res.status(status).json({ error: safe });
  }
}
