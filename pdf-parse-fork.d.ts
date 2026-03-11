declare module "pdf-parse-fork" {
  function parse(dataBuffer: Buffer): Promise<{
    text: string
    numpages: number
    numrender: number
    info: any
    metadata: any
    version: string
  }>
  export default parse
}
