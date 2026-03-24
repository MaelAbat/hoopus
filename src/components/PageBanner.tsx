interface PageBannerProps {
  title: string;
  subtitle: string;
  image: string;
  extra?: React.ReactNode;
}

export default function PageBanner({ title, subtitle, image, extra }: PageBannerProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border-t">
      <div className="absolute inset-0">
        <img
          src={image}
          alt=""
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/55 to-black/30" />
      </div>
      <div className="relative px-8 py-10 sm:px-10 sm:py-12">
        <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          {title}
        </h1>
        <p className="mt-2 text-sm text-white/60 sm:text-base">
          {subtitle}
        </p>
        {extra && <div className="mt-3">{extra}</div>}
      </div>
    </div>
  );
}
