export class NextRequest extends Request {}

export class NextResponse extends Response {
  static json(body, init = {}) {
    return Response.json(body, init)
  }

  static redirect(url, init = 307) {
    return Response.redirect(url, init)
  }
}
