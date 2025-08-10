import { toast } from "sonner";

interface RetryOptions {
    retries?: number;
    delay?: number;
}

export async function fetchWithRetry(
    url: string,
    options: RequestInit = {},
    retryOptions: RetryOptions = {}
): Promise<Response> {
    const { retries = 3, delay = 1000 } = retryOptions;

    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url, options);

            // Don't retry on client-side errors (4xx) or success (2xx)
            if (response.ok || (response.status >= 400 && response.status < 500)) {
                return response;
            }

            // For server-side errors (5xx), throw to trigger a retry
            throw new Error(`Server error: ${response.status}`);

        } catch (error: any) {
            console.error(`Attempt ${i + 1} failed: ${error.message}`);
            if (i === retries - 1) {
                // Last retry failed, re-throw the error to be caught by the caller
                toast.error(`サーバーへの接続に失敗しました。時間をおいて再試行してください。`);
                throw error;
            }
            // Wait for the delay before the next retry (exponential backoff)
            await new Promise(res => setTimeout(res, delay * Math.pow(2, i)));
        }
    }

    // This should not be reachable, but as a fallback:
    throw new Error("API request failed after all retries.");
}
