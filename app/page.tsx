import Image from "next/image";
export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-8">
      <div className="max-w-xl w-full text-center space-y-6">
        <Image
          src="/logo.png"
          alt="Logo"
          width={180}
          height={180}
          className="mx-auto mb-8"
        />
        <h1 className="text-5xl font-bold">Mein Quiz</h1>

        <p className="text-slate-300">
          Spiele gegen deine Freunde.
        </p>

        <div className="grid gap-4">
                    <a
  href="/host"
  className="bg-white text-black rounded-xl px-6 py-4 font-semibold block"
>
  Quiz erstellen
</a>
<a
  href="/join"
  className="border border-white rounded-xl px-6 py-4 font-semibold block"
>
  Quiz beitreten
</a>
        </div>
      </div>
    </main>
  );
}