import { getCsrfHeaders } from "@/lib/csrf-client"
import { serviceContracts } from "@/lib/services/contracts"

async function request(method: "POST" | "DELETE", accessToken?: string) {
  const headers = getCsrfHeaders(
    accessToken
      ? {
          Authorization: `Bearer ${accessToken}`,
        }
      : undefined
  )

  await fetch(serviceContracts.auth.session, {
    method,
    headers,
  })
}

export async function syncServerSession(accessToken: string) {
  await request("POST", accessToken)
}

export async function clearServerSession() {
  await request("DELETE")
}
