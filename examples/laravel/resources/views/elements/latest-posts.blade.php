<div class="posts">
    <h3>{{ $heading }}</h3>
    <ul>
        @foreach ($posts as $post)
            <li>{{ $post->title }}</li>
        @endforeach
    </ul>
</div>
