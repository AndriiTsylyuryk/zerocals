-- Create storage bucket for about section images
INSERT INTO storage.buckets (id, name, public)
VALUES ('about-images', 'about-images', true);

-- Create RLS policies for about-images bucket
CREATE POLICY "Anyone can view about images"
ON storage.objects
FOR SELECT
USING (bucket_id = 'about-images');

CREATE POLICY "Admins can upload about images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'about-images' 
  AND public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can update about images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'about-images' 
  AND public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can delete about images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'about-images' 
  AND public.has_role(auth.uid(), 'admin'::app_role)
);

-- Create about_content table
CREATE TABLE public.about_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL DEFAULT 'About ZeroCals',
  content TEXT NOT NULL DEFAULT 'At ZeroCals, we believe you shouldn''t have to sacrifice taste for health.',
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.about_content ENABLE ROW LEVEL SECURITY;

-- RLS policies for about_content
CREATE POLICY "Anyone can view about content"
ON public.about_content
FOR SELECT
USING (true);

CREATE POLICY "Admins can manage about content"
ON public.about_content
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Insert default content
INSERT INTO public.about_content (title, content)
VALUES (
  'About ZeroCals',
  'At ZeroCals, we believe you shouldn''t have to sacrifice taste for health. Our mission is to create delicious, low-calorie desserts that satisfy your sweet tooth without the guilt.

Founded in 2024, ZeroCals was born from a simple idea: healthy desserts can taste amazing. We use only the finest ingredients and innovative techniques to craft treats that are as good for you as they are delicious.'
);

-- Add trigger for updated_at
CREATE TRIGGER update_about_content_updated_at
BEFORE UPDATE ON public.about_content
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();